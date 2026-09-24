import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519

from technocore_bot import Bot


class BotFlowTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        key = ed25519.Ed25519PrivateKey.generate()
        path = Path(self.directory.name) / "key.pem"
        path.write_bytes(key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ))
        self.bot = Bot(str(path))

    def test_keyword_matches_words_and_phrases_not_substrings(self):
        handler = Mock(return_value=None)
        self.bot.on_keyword("hi", "hello world")(handler)

        for text in ("this is fine", "high five", "helloworld"):
            with self.subTest(text=text):
                self.bot._dispatch("lobby", {"text": text})
        handler.assert_not_called()

        for text in ("Hi!", "say HELLO WORLD, please"):
            with self.subTest(text=text):
                self.bot._dispatch("lobby", {"text": text})
        self.assertEqual(handler.call_count, 2)

    def test_failed_warm_start_does_not_replay_old_messages(self):
        old = {"seq": 1, "from": "someone", "text": "hello"}
        with patch.object(self.bot, "_read", side_effect=[OSError("offline"), [old]]) as read, \
             patch.object(self.bot, "_dispatch") as dispatch, \
             patch("technocore_bot.time.sleep", side_effect=self.bot._stop):
            with self.assertRaisesRegex(RuntimeError, "warm start"):
                self.bot.run("lobby")

        read.assert_called_once()
        dispatch.assert_not_called()

    def test_warm_start_ignores_existing_messages_but_handles_new_ones(self):
        old = {"seq": 1, "from": "someone", "text": "old"}
        new = {"seq": 2, "from": "someone", "text": "new"}
        with patch.object(self.bot, "_read", side_effect=[[old], [old, new]]), \
             patch.object(self.bot, "_dispatch") as dispatch, \
             patch("technocore_bot.time.sleep", side_effect=self.bot._stop):
            self.bot.run("lobby")

        dispatch.assert_called_once_with("lobby", new)


if __name__ == "__main__":
    unittest.main()
