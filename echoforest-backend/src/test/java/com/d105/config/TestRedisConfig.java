package com.d105.config;

import org.mockito.Mockito;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;

/**
 * 테스트용 Redis Mock 설정
 * - 실제 Redis 서버 없이 테스트 가능
 * - @SpringBootTest 테스트에서 자동으로 적용됨
 */
@TestConfiguration
public class TestRedisConfig {

    @Bean
    @Primary
    public RedisConnectionFactory mockRedisConnectionFactory() {
        return Mockito.mock(RedisConnectionFactory.class);
    }

    @Bean
    @Primary
    @SuppressWarnings("unchecked")
    public RedisTemplate<String, String> redisTemplate() {
        RedisTemplate<String, String> mockTemplate = Mockito.mock(RedisTemplate.class);

        // ValueOperations Mock
        ValueOperations<String, String> valueOps = Mockito.mock(ValueOperations.class);
        when(mockTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(anyString())).thenReturn(null);
        doNothing().when(valueOps).set(anyString(), anyString());
        doNothing().when(valueOps).set(anyString(), anyString(), any());

        // SetOperations Mock
        SetOperations<String, String> setOps = Mockito.mock(SetOperations.class);
        when(mockTemplate.opsForSet()).thenReturn(setOps);
        when(setOps.members(anyString())).thenReturn(java.util.Collections.emptySet());
        when(setOps.size(anyString())).thenReturn(0L);
        when(setOps.add(anyString(), any())).thenReturn(1L);

        // HashOperations Mock
        HashOperations<String, Object, Object> hashOps = Mockito.mock(HashOperations.class);
        when(mockTemplate.opsForHash()).thenReturn(hashOps);
        when(hashOps.get(anyString(), any())).thenReturn(null);
        doNothing().when(hashOps).put(anyString(), any(), any());
        when(hashOps.increment(anyString(), any(), anyLong())).thenReturn(1L);
        when(hashOps.keys(anyString())).thenReturn(java.util.Collections.emptySet());

        // 기타 메서드 Mock
        when(mockTemplate.hasKey(anyString())).thenReturn(false);
        when(mockTemplate.delete(anyString())).thenReturn(true);
        when(mockTemplate.expire(anyString(), any())).thenReturn(true);

        return mockTemplate;
    }

    @Bean
    @Primary
    public StringRedisTemplate stringRedisTemplate() {
        StringRedisTemplate mockTemplate = Mockito.mock(StringRedisTemplate.class);

        @SuppressWarnings("unchecked")
        ValueOperations<String, String> valueOps = Mockito.mock(ValueOperations.class);
        when(mockTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(anyString())).thenReturn("OK");

        return mockTemplate;
    }
}
