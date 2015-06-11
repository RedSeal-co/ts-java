package com.redseal.featureset.overloading;

public class Overloading {

  public static class Bar extends java.lang.Object {
    // We create this class just so that class Foo below does not directly inherit from Object.
    public Bar() {}
  }

  public static class Foo extends Bar {
    public Foo() {}

    // A gratuitous overload of the equals from java.lang.Object
    public void wait(Double seconds) throws InterruptedException {
      long milliseconds = (long) (seconds * 1.0e6);
      wait(milliseconds);
    }

    public boolean equals(Foo other, boolean b) {
      return other.equals(this) ^ b;
    }
  }

}
