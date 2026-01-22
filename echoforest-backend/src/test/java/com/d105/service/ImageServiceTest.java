package com.d105.service;

import com.d105.entity.Image;
import com.d105.entity.User;
import com.d105.repository.ImageRepository;
import com.d105.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional // 테스트 끝나면 DB 롤백
class ImageServiceTest {

    @Autowired
    private ImageService imageService;

    @Autowired
    private ImageRepository imageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EntityManager entityManager; // EntityManager 주입 추가

    @Value("${file.upload-dir:./uploads/}")
    private String uploadDir;

    // 테스트용 유저 생성 헬퍼
    private User createTestUser() {
        User user = User.builder()
                .username("testuser_" + System.currentTimeMillis())
                .password("password")
                .nickname("tester_" + System.currentTimeMillis())
                .email("test@example.com")
                .build();
        return userRepository.save(user);
    }

    // 테스트 끝나면 생성된 파일들 정리
    @AfterEach
    void cleanupFiles() throws IOException {
        Path rootPath = Paths.get(uploadDir);
        if (Files.exists(rootPath)) {
            try (Stream<Path> walk = Files.walk(rootPath)) {
                walk.sorted(Comparator.reverseOrder())
                        .map(Path::toFile)
                        .forEach(File::delete);
            }
        }
    }

    @Test
    @DisplayName("이미지 업로드 시 날짜 폴더에 파일이 생성되고 DB에 저장된다")
    void uploadImage_Success() throws IOException {
        // given
        User user = createTestUser();
        MockMultipartFile file = new MockMultipartFile(
                "file", "test.webp", "image/webp", "dummy content".getBytes());

        // when
        Image savedImage = imageService.uploadImage(
                file, user.getId(), null, 1, null, "ROOM1", "MOTION");

        // then
        // 1. DB 저장 확인
        assertThat(savedImage.getId()).isNotNull();
        assertThat(savedImage.getFileName()).contains(LocalDate.now().toString()); // 날짜 폴더 포함 여부

        // 2. 파일 시스템 생성 확인
        Path filePath = Paths.get(uploadDir, savedImage.getFileName());
        assertThat(Files.exists(filePath)).isTrue();
    }

    @Test
    @DisplayName("Soft Delete: 사용자 삭제 시 파일은 남고 DB deletedAt만 설정된다")
    void softDelete_Success() throws IOException {
        // given
        User user = createTestUser();
        MockMultipartFile file = new MockMultipartFile(
                "file", "soft.webp", "image/webp", "content".getBytes());
        Image image = imageService.uploadImage(file, user.getId(), null, 1, null, "ROOM1", "MOTION");

        // when
        imageService.deleteImage(image.getId(), user.getId());

        // then
        Image deletedImage = imageRepository.findById(image.getId()).orElseThrow();

        // 1. deletedAt이 설정되어야 함
        assertThat(deletedImage.getDeletedAt()).isNotNull();

        // 2. 파일은 여전히 존재해야 함
        Path filePath = Paths.get(uploadDir, image.getFileName());
        assertThat(Files.exists(filePath)).isTrue();
    }

    @Test
    @DisplayName("Soft Delete 된 이미지는 조회 목록에서 제외된다")
    void getMyImages_FiltersDeleted() throws IOException {
        // given
        User user = createTestUser();
        // 이미지 2개 업로드
        MockMultipartFile file1 = new MockMultipartFile("f1", "1.webp", "image/webp", "c1".getBytes());
        MockMultipartFile file2 = new MockMultipartFile("f2", "2.webp", "image/webp", "c2".getBytes());

        Image img1 = imageService.uploadImage(file1, user.getId(), null, 1, null, "R1", "MOTION");
        Image img2 = imageService.uploadImage(file2, user.getId(), null, 1, null, "R1", "MOTION");

        // img1만 삭제
        imageService.deleteImage(img1.getId(), user.getId());

        // when
        List<Image> myImages = imageService.getMyImages(user.getId());

        // then
        assertThat(myImages).hasSize(1);
        assertThat(myImages.get(0).getId()).isEqualTo(img2.getId());
    }

    @Test
    @DisplayName("스케줄러: 7일 지난 이미지는 파일과 DB에서 완전 삭제된다")
    void deleteOldImages_HardDelete() throws IOException {
        // given
        User user = createTestUser();
        MockMultipartFile file = new MockMultipartFile("old", "old.webp", "image/webp", "old".getBytes());
        Image image = imageService.uploadImage(file, user.getId(), null, 1, null, "R1", "MOTION");
        Path filePath = Paths.get(uploadDir, image.getFileName());

        // 강제로 생성일(createdAt)을 8일 전으로 조작
        // @CreatedDate, updatable=false 설정 때문에 repository.save()로는 수정되지 않음 -> Native Query 사용
        imageRepository.flush(); // INSERT 쿼리 확정

        //  네이티브 쿼리에서 파라미터 바인딩 오류 방지를 위해 위치 기반 파라미터(?1, ?2) 사용
        entityManager.createNativeQuery("UPDATE images SET created_at = ?1 WHERE id = ?2")
                .setParameter(1, LocalDateTime.now().minusDays(8))
                .setParameter(2, image.getId())
                .executeUpdate();

        // 영속성 컨텍스트 초기화 (DB에서 다시 조회하도록)
        entityManager.clear();

        // when
        int deletedCount = imageService.deleteOldImages();

        // then
        // 1. 삭제된 개수 확인
        assertThat(deletedCount).isEqualTo(1);

        // 2. DB에서 완전히 사라졌는지 확인
        assertThat(imageRepository.findById(image.getId())).isEmpty();

        // 3. 파일도 사라졌는지 확인
        assertThat(Files.exists(filePath)).isFalse();
    }
}