package fr.juliette.thecode;

import static org.junit.Assert.assertEquals;
import org.junit.Test;

public class ExampleUnitTest {
    @Test
    public void test1() {
        Code code = new Code(0);
        String result = code.getCode("clef", "site");
        assertEquals("u8!fpdVdK*#Bp@6(9fed", result);
    }

    @Test
    public void test2() {
        Code code = new Code(0);
        String result = code.getCode("c", "s");
        assertEquals("wDwWUk$@<%r+ceYvVqoI", result);
    }
}
