package fr.juliette.thecode;

import static org.junit.Assert.assertEquals;
import org.junit.Test;

public class GenerateUnitTest {
    @Test
    public void generate1() {
        Code code = new Code(0);
        String result = code.getCode("clef", "site");
        assertEquals("u8YfpdVdK*#Bpy6(9f*5", result);
    }

    @Test
    public void generate2() {
        Code code = new Code(0);
        String result = code.getCode("c", "s");
        assertEquals("wDwWUk$@<%r1f:YvVqUI", result);
    }
}
