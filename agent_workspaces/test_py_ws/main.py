import hashlib
import secrets
import base64
import hmac

class DataProtector:
    def __init__(self, password: str):
        self.password = password.encode()

    def _derive_key(self, salt: bytes) -> bytes:
        """اشتقاق مفتاح تشفير قوي باستخدام PBKDF2"""
        return hashlib.pbkdf2_hmac(
            'sha256',
            self.password,
            salt,
            100000
        )

    def encrypt(self, data: str) -> str:
        """تشفير البيانات باستخدام XOR مع مفتاح مشتق (نموذج تعليمي آمن)"""
        salt = secrets.token_bytes(16)
        key = self._derive_key(salt)
        data_bytes = data.encode()
        
        # تطبيق التشفير (XOR مع المفتاح المشتق)
        encrypted = bytes([b ^ key[i % len(key)] for i, b in enumerate(data_bytes)])
        
        # دمج الملح مع البيانات المشفرة
        return base64.b64encode(salt + encrypted).decode('utf-8')

    def decrypt(self, encrypted_data: str) -> str:
        """فك تشفير البيانات"""
        raw_data = base64.b64decode(encrypted_data)
        salt = raw_data[:16]
        encrypted = raw_data[16:]
        key = self._derive_key(salt)
        
        decrypted = bytes([b ^ key[i % len(key)] for i, b in enumerate(encrypted)])
        return decrypted.decode('utf-8')

if __name__ == '__main__':
    # اختبار النظام
    secret_message = "هذه بيانات حساسة جداً يجب حمايتها"
    user_password = "SuperSecretPassword123!"
    
    protector = DataProtector(user_password)
    
    # عملية التشفير
    encrypted = protector.encrypt(secret_message)
    print(f"البيانات المشفرة: {encrypted}")
    
    # عملية فك التشفير
    decrypted = protector.decrypt(encrypted)
    print(f"البيانات بعد فك التشفير: {decrypted}")
    
    # التحقق
    assert secret_message == decrypted
    print("\n[SUCCESS] تم التشفير وفك التشفير بنجاح.")