package com.redseal.featureset;

public class SomeClass extends SomeAbstractClass {

    public SomeClass() {
        theInt = 42;
        theLong = java.lang.Long.MAX_VALUE;
        theString = "Just some class.";
    }

    public SomeClass(int x, long y, String z) {
        theInt = x;
        theLong = y;
        theString = z;
    }

    private int theInt;
    private long theLong;
    private String theString;

    public int getInt() { return theInt; }
    public long getLong() { return theLong; }
    public String getString() { return theString; }

    public void setInt(int x) { theInt = x; }
    public void setLong(long x) { theLong = x; }
    public void setString(String x) { theString = x; }
}
