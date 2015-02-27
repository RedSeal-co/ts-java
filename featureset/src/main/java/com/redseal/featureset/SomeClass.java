package com.redseal.featureset;

public class SomeClass extends SomeAbstractClass {

    public SomeClass() {
        theInt = 42;
        theLong = java.lang.Long.MAX_VALUE;
        theString = "Just some class.";
        theBoolean = true;
        theDouble = java.lang.Math.PI;

        theList = new String[]{"a", "b", "c"};

        theArray = new int[][]{{1, 2, 3}, {4, 5, 6}};

        theThings = new Thing[2][3];
        for (int i=0; i<2; ++i) {
            for (int j=0; j<3; ++j) {
                theThings[i][j] = new Thing(i*3 + j);
            }
        }
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
    private int[][] theArray;
    private Thing[][] theThings;

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

    public int[][] getArray() {
        return theArray;
    }

    public void setArray(int[][] x) {
        theArray = x;
    }

    public Thing[][] getThings() {
        return theThings;
    }

    public void setThings(Thing[][] things) {
        theThings = things;
    }

    public Object getStringObject() {
        return "A String";
    }

    public Object getShortObject() {
        final short theAnswer = (short) 42;
        return new Short(theAnswer);
    }

    public Object getLongObject() {
        return new Long(java.lang.Long.MAX_VALUE);
    }

    public Object getDoubleObject() {
        return new Double(java.lang.Math.PI);
    }
}
