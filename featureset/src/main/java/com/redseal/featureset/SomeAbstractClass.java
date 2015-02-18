package com.redseal.featureset;

public abstract class SomeAbstractClass implements SomeInterface {


    public abstract int getInt();
    public abstract long getLong();
    public abstract String getString();
    public abstract boolean getBoolean();
    public abstract double getDouble();
    public abstract String[] getList();

    public abstract void setInt(int x);
    public abstract void setLong(long x);
    public abstract void setString(String x);
    public abstract void setBoolean(boolean x);
    public abstract void setDouble(double x);
    public abstract void setList(String... args);

    // Here is one method we implement in the abstract class
    public String joinList(String sep) {
        return String.join(sep, getList());
    }
}
