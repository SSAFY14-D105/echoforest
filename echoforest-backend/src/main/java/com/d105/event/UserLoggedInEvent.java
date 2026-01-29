package com.d105.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class UserLoggedInEvent extends ApplicationEvent {
    private final Long userId;
    private final String username;
    private final String newToken;

    public UserLoggedInEvent(Object source, Long userId, String username, String newToken) {
        super(source);
        this.userId = userId;
        this.username = username;
        this.newToken = newToken;
    }
}
