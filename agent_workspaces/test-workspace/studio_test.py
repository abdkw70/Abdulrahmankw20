import hmac
import hashlib
import secrets

class HMACManager:
    def __init__(self, secret_key: bytes):
        """
        تهيئة مدير HMAC باستخدام مفتاح سري.
        """
        self.secret_key = secret_key

    def generate_hmac(self, message: str) -> str:
        """
        توليد توقيع HMAC للرسالة باستخدام SHA-256.
        """
        message_bytes = message.encode('utf-8')
        signature = hmac.new(
            self.secret_key, 
            message_bytes, 
            hashlib.sha256
        ).hexdigest()
        return signature

    def verify_hmac(self, message: str, signature: str) -> bool:
        """
        التحقق من صحة التوقيع باستخدام hmac.compare_digest 
        لمنع هجمات التوقيت (Timing Attacks).
        """
        expected_signature = self.generate_hmac(message)
        return hmac.compare_digest(expected_signature, signature)

if __name__ == '__main__':
    # 1. إعداد مفتاح سري آمن
    secret = secrets.token_bytes(32)
    manager = HMACManager(secret)

    # 2. البيانات المراد توقيعها
    data = "هذه رسالة سرية تتطلب التحقق من السلامة"
    
    # 3. توليد التوقيع
    sig = manager.generate_hmac(data)
    print(f"الرسالة: {data}")
    print(f"التوقيع الناتج: {sig}")

    # 4. اختبار التحقق (حالة النجاح)
    is_valid = manager.verify_hmac(data, sig)
    print(f"هل التوقيع صالح؟: {is_valid}")

    # 5. اختبار التحقق (حالة التلاعب بالبيانات)
    tampered_data = "هذه رسالة سرية تم التلاعب بها"
    is_valid_tampered = manager.verify_hmac(tampered_data, sig)
    print(f"هل التوقيع صالح بعد التلاعب؟: {is_valid_tampered}")

    # تأكيدات برمجية
    assert is_valid is True
    assert is_valid_tampered is False
    print("\nتم اختبار الخوارزمية بنجاح.")