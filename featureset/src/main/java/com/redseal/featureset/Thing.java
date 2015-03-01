package com.redseal.featureset;

public class Thing {

    private int theValue;

    public Thing(int value) {
        theValue = value;
    }

    public String toString() {
        return "Thing" + Integer.toString(theValue);
    }

    public void set(int value) {
        theValue = value;
    }
}
