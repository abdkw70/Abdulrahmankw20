#!/usr/bin/env python3
import hashlib
import json

def test_hash():
    data = b"ApexSec-Real-Verification-Test"
    digest = hashlib.sha256(data).hexdigest()
    return {"digest": digest, "len": len(digest)}

if __name__ == '__main__':
    res = test_hash()
    print("OUTPUT_JSON:" + json.dumps(res))
    assert res["len"] == 64
    print("[SUCCESS] All assertions passed!")
