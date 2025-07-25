#Problem: Caesar Cipher encoding and decoding
def caesar_cipher_encrypt(message, shift):
    result = ""

    for char in message:
        if char.isalpha():
           # print(char)
            # Preserve case
            base = ord('A') if char.isupper() else ord('a')
            # Shift character and wrap around alphabet
            result += chr((ord(char) - base + shift) % 26 + base)
        else:
            result += char  # Leave non-alphabet characters unchanged

    return result


def caesar_cipher_decrypt(cipher_text, shift):
    # Decoding is just encoding with negative shift
    return caesar_cipher_encrypt(cipher_text, -shift)
message = "Hello, Caesar!"
shift = 3

encrypted = caesar_cipher_encrypt(message, shift)
print("Encrypted:", encrypted)  # Output: Khoor, Fdhvdu!

decrypted = caesar_cipher_decrypt(encrypted, shift)
print("Decrypted:", decrypted)  # Output: Hello, Caesar!