import hashlib
import os

class CryptoHasher:
    """
    فئة متخصصة لتجزئة البيانات باستخدام SHA-256 مع دعم الـ Salt.
    """
    
    @staticmethod
    def generate_salt(length: int = 16) -> bytes:
        """توليد Salt عشوائي آمن تشفيرياً."""
        return os.urandom(length)

    @staticmethod
    def hash_data(data: str, salt: bytes = None) -> dict:
        """
        تجزئة البيانات النصية.
        يعيد قاموساً يحتوي على الـ Hash والـ Salt المستخدم.
        """
        if salt is None:
            salt = CryptoHasher.generate_salt()
            
        sha256 = hashlib.sha256()
        # دمج الـ Salt مع البيانات قبل التجزئة
        sha256.update(salt + data.encode('utf-8'))
        
        return {
            "hash": sha256.hexdigest(),
            "salt": salt.hex()
        }

    @staticmethod
    def verify_data(data: str, stored_hash: str, stored_salt: str) -> bool:
        """
        التحقق من صحة البيانات بمقارنة الـ Hash الناتج مع المخزن.
        """
        salt_bytes = bytes.fromhex(stored_salt)
        new_hash = CryptoHasher.hash_data(data, salt_bytes)
        return new_hash["hash"] == stored_hash

# --- كتلة التنفيذ والتحقق ---
if __name__ == '__main__':
    print("--- بدء اختبار خوارزمية التجزئة ---")
    
    secret_message = "MySuperSecretPassword123"
    
    # 1. التجزئة
    result = CryptoHasher.hash_data(secret_message)
    print(f"البيانات الأصلية: {secret_message}")
    print(f"الـ Salt المولد: {result['salt']}")
    print(f"الـ Hash الناتج: {result['hash']}")
    
    # 2. التحقق من النجاح
    is_valid = CryptoHasher.verify_data(secret_message, result['hash'], result['salt'])
    print(f"هل التحقق ناجح؟ {is_valid}")
    
    # 3. التحقق من الفشل (محاولة كلمة مرور خاطئة)
    is_invalid = CryptoHasher.verify_data("WrongPassword", result['hash'], result['salt'])
    print(f"هل التحقق من كلمة مرور خاطئة ناجح؟ {is_invalid}")
    
    # تأكيدات برمجية
    assert is_valid == True
    assert is_invalid == False
    print("--- تم الاختبار بنجاح ---")