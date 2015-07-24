package com.redseal.featureset;

public abstract class SomeAbstractClass implements SomeInterface {


    public abstract int getInt();
    public abstract long getLong();
    public abstract String getString();
    public abstract boolean getBoolean();
    public abstract double getDouble();
    public abstract String[] getList();
    public abstract int[][] getArray();
    public abstract Thing[][] getThings();

    public abstract void setInt(int x);
    public abstract void setLong(long x);
    public abstract void setString(String x);
    public abstract void setBoolean(boolean x);
    public abstract void setDouble(double x);
    public abstract void setList(String[] args);
    public abstract void setListVarArgs(String... args);
    public abstract void setArray(int[][] x);
    public abstract void setThings(Thing[][] things);
    public abstract String setObjects(Object[] args);
    public abstract String setObjectsVarArgs(Object... args);

    public abstract Object getStringObject();
    public abstract Object getShortObject();
    public abstract Object getLongObject();
    public abstract Object getDoubleObject();

    // Here is one method we implement in the abstract class
    public String joinList(String sep) {
        return String.join(sep, getList());
    }

    // A static field with the same name is also declared in SomeClass
    public static int mField = 1;
}
