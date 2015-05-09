package com.redseal.featureset;

public class AnonClassTest {
    public static String test() {
      TinyInterface tiny = new TinyInterface() {
        public String who() {
          return "anon";
        }
      };
      return tiny.who();
    }
}
