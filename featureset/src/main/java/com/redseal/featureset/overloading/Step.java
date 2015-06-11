package com.redseal.featureset.overloading;

public interface Step extends java.util.Iterator {
  // This snippet reproduces the ts-java bug first seen in Tinkerpop 3.0.0M9-incubating
  boolean equals(Step other, boolean t);
}

