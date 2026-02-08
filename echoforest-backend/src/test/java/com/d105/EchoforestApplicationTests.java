package com.d105;

import com.d105.config.TestRedisConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestRedisConfig.class)
class EchoforestApplicationTests {

	@Test
	void contextLoads() {
	}

}
