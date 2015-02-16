package com.redseal.featureset;

public class SomeClass extends SomeAbstractClass {

    public SomeClass() {
        theInt = 42;
        theLong = java.lang.Long.MAX_VALUE;
        theString = "Just some class.";
        theBoolean = true;
        theDouble = java.lang.Math.PI;

        theList = new String[]{"a", "b", "c"};
    }

    public SomeClass(int x, long y, String z, boolean b, double d) {
        theInt = x;
        theLong = y;
        theString = z;
        theBoolean = b;
        theDouble = d;
    }

    private int theInt;
    private long theLong;
    private String theString;
    private boolean theBoolean;
    private double theDouble;
    private String[] theList;

    public int getInt() { return theInt; }
    public long getLong() { return theLong; }
    public String getString() { return theString; }
    public boolean getBoolean() { return theBoolean; }
    public double getDouble() { return theDouble; }

    public void setInt(int x) { theInt = x; }
    public void setLong(long x) { theLong = x; }
    public void setString(String x) { theString = x; }
    public void setBoolean(boolean x) { theBoolean = x; }
    public void setDouble(double x) { theDouble = x; }

    public String[] getList() {
        return theList;
    }

    public void setList(String... args) {
        theList = args;
    }

}
