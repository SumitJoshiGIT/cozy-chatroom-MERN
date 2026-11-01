# End-to-end encryption

Encryption is opt-in per account. A chat is encrypted when every member has turned it on, and the composer says which state the open chat is in. If anyone in a chat has no key, that chat stays readable by the server.

## How it works

- **Identity:** each account has one P-256 ECDH key pair, made in the browser. The server stores the public key.
- **Backup:** the private key reaches the server only encrypted with AES-256-GCM, under a key derived from the user's passphrase with PBKDF2-SHA-256 (600,000 rounds). The passphrase never leaves the device. New devices restore the key with it.
- **On a device:** the private key is kept in IndexedDB as a non-extractable `CryptoKey`, and is deleted on logout.
- **Messages:** each message gets a random AES-256-GCM key. That key is wrapped once for every chat member, including the sender, using a key from ECDH between the two people. The ciphertext is bound to the sender and the full recipient list.
- **Groups:** wrapping per message means someone removed from a group can't read anything sent afterwards, and new members can't read earlier messages.
- **Files:** each attachment has its own AES key, kept inside the sealed message. The server stores opaque `.bin` files.

## What the server can't see

Message text, edits, file contents, file names and types, voice notes, and shared locations in encrypted chats.

## What the server can still see

Who talks to whom, when, message and file sizes, group names and membership, profiles, reactions, read receipts and pins.

## Limits

- **Trusting keys:** the first key seen for a contact is trusted, and a later change raises a warning. Comparing safety numbers in the contact's profile is what rules out a server swapping keys on first contact. Those remembered keys are wiped on logout.
- **Forward secrecy:** there is none. Anyone who gets a private key can read every message sent to it. Stealing the key from the server needs the backup plus the passphrase, so a weak passphrase can be guessed offline.
- **The web client:** the server and Vercel deliver the code that does the encrypting, so a compromised deploy could ship code that steals keys. This applies to any browser-based encrypted app.
- **This device:** decrypted messages are cached in the browser until logout.
- **Replay:** the server can't forge or alter a message, but it could withhold one, or send a sealed message to the same people again.
- **Forgotten passphrases:** there is no recovery. Resetting makes a new key, and older encrypted messages become unreadable.
- **Calls:** LiveKit media is encrypted in transit but not end to end.
- **Live location:** not available in encrypted chats, because the server relays each update. Sharing your current location is encrypted.
- **Search:** global search skips encrypted messages. In-chat search covers encrypted messages already loaded on the device.
- **Existing messages:** messages sent before encryption was turned on stay as they are.
- **Push notifications:** they say "New encrypted message" and contain no text.
