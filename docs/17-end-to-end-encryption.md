# End-to-end encryption

Encryption is on by default. The first time an account signs in, its browser creates a key and tells the user encryption is on. A chat is encrypted once every member has signed in with this version. Until then the composer says it isn't encrypted, because a key can only be made on the person's own device.

## How it works

- **Identity:** each account has one P-256 ECDH key pair, made in the browser. The server stores the public key.
- **New devices:** private keys never reach the server, not even encrypted. A new device shows a code and asks a device already signed in for the key. If the user approves after checking the code matches, the key is sent sealed to the new device. The server only relays it.
- **On a device:** the private key is kept in IndexedDB and stays after logout, because it may be the only copy.
- **Messages:** each message gets a random AES-256-GCM key. That key is wrapped once for every chat member, including the sender, using a key from ECDH between the two people. The ciphertext is bound to the sender and the full recipient list.
- **Groups:** wrapping per message means someone removed from a group can't read anything sent afterwards, and new members can't read earlier messages.
- **Files:** each attachment has its own AES key, kept inside the sealed message. The server stores opaque `.bin` files.

## What the server can't see

Message text, edits, file contents, file names and types, voice notes, and location coordinates in encrypted chats.

## What the server can still see

Who talks to whom, when, message and file sizes, group names and membership, profiles, reactions, read receipts, pins and call history, including missed calls.

## Limits

- **Trusting keys:** the first key seen for a contact is trusted, and a later change raises a warning. Comparing safety numbers in the contact's profile is what rules out a server swapping keys on first contact.
- **Forward secrecy:** there is none. Anyone who gets a private key can read every message sent to it.
- **Losing every device:** there is no backup. If a user clears site data or loses all their devices, "Start fresh" makes a new key and older encrypted messages become unreadable.
- **Shared computers:** logging out keeps the key on that browser. Clearing site data removes it.
- **The web client:** the server and Vercel deliver the code that does the encrypting, so a compromised deploy could ship code that steals keys. This applies to any browser-based encrypted app.
- **This device:** decrypted messages are cached in the browser until logout.
- **Replay:** the server can't forge or alter a message, but it could withhold one, or send a sealed message to the same people again.
- **Calls:** LiveKit media is encrypted in transit but not end to end.
- **Live location:** coordinates are encrypted, but the server knows sharing is on and when it ends.
- **Search:** global search skips encrypted messages. In-chat search covers encrypted messages already loaded on the device.
- **Existing messages:** messages sent before encryption was turned on stay as they are.
- **Push notifications:** they say "New encrypted message" and contain no text.
