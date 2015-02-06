package com.redseal.hellojava;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class HelloJavaTest {

    @Test
    public void trivialTest() {
        assertEquals(HelloJava.sayHello(), "Hello, Java!");
    }
}
