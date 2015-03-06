package com.redseal.featureset.ambiguous;

// This class (com.redseal.featureset.ambiguous.Thing) uses the same class name
// as com.redseal.featureset.Thing. The only reason for its existence is to
// test that ts-java correctly handles such name conflicts.

public class Thing {

    private String theValue;

    public Thing(String value) {
        theValue = value;
    }

    public String toString() {
        return "Ambiguous Thing " + theValue;
    }

    public void set(String value) {
        theValue = value;
    }

    public Nested newNested(int x) {
      return new Nested(x);
    }

    public class Nested {
      Nested(int x) {
        theX = x;
      }

      public String toString() {
          return "Ambiguous Thing.Nested " + Integer.toString(theX);
      }

      private int theX;
    }
}
