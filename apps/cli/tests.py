import unittest
import thecode


class MyTestCase(unittest.TestCase):

    def setUp(self):
        pass

    def tearDown(self):
        pass

    def test_1(self):
        result = thecode.code("site", "clef", True, True, True, True, 20)
        self.assertEqual(result[0], "u8!fpdVdK*#Bp@6(9fed")

    def test_2(self):
        result = thecode.code("s", "c", True, True, True, True, 20)
        self.assertEqual(result[0], "wDwWUk$@<%r+ceYvVqoI")


if __name__ == '__main__':
    unittest.main()
