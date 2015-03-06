package com.redseal.featureset;

public class Thing {

    private int theValue;

    public Thing(int value) {
        theValue = value;
        theInstanceField = "instance thingy";

        mPrivateInt = 0;
        mProtectedInt = 1;
        mPackageInt = 2;
    }

    public String toString() {
        return "Thing" + Integer.toString(theValue);
    }

    public void set(int value) {
        theValue = value;
    }

    public String theInstanceField;

    public static String theStaticField;

    static
    {
        theStaticField = "static thingy";
        mPrivateStaticInt = 0;
        mProtectedStaticInt = 1;
        mPackageStaticInt = 2;
    }

    private static int mPrivateStaticInt;
    protected static int mProtectedStaticInt;
    static int mPackageStaticInt;

    private int mPrivateInt;
    protected  int mProtectedInt;
    int mPackageInt;
}
