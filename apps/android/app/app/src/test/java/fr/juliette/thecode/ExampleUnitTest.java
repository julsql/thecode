package fr.juliette.thecode;

import org.junit.Test;
import static org.junit.Assert.*;

/**
 * Example local unit test, which will execute on the development machine (host).
 *
 * @see <a href="http://d.android.com/tools/testing">Testing documentation</a>
 */
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