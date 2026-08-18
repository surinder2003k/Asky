P = "/home/ubuntu/ai_chat_app/src/components/ChatScreen.tsx"
s = open(P).read()

# The paste handler currently:
# onPaste={(e) => {
#   const files = ...;
#   if (files.length === 0) return;
#     e.preventDefault();   <-- inside what? stray; should be inside an if-else or directly after return. JS allows it but parser error elsewhere? Actually valid JS. But TSX inside JSX attribute: statements fine in {...}. So error must be elsewhere.
# Let's normalize the whole onPaste block to be safe.
old = """              onPaste={(e) => {
                const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
                if (files.length === 0) return;
                  e.preventDefault();
                  if (!image) pickImage(files[0]);
                  if (files.length > 1) addExtraImages(files.slice(1));
                }
              }}"""
new = """              onPaste={(e) => {
                const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
                if (files.length === 0) return;
                e.preventDefault();
                if (!image) pickImage(files[0]);
                if (files.length > 1) addExtraImages(files.slice(1));
              }}"""
n = s.count(old)
s = s.replace(old, new)
print("paste replaced:", n)

# ALSO there may be a leftover stray `}` earlier (v3's j-replacement turned `if (file) {` into `if (files.length === 0) return;` but original block had a closing `}` that was replaced? Let's also fix:
old2 = """              onPaste={(e) => {
                const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
                if (file) {
                  e.preventDefault();
                  pickImage(file);
                }
              }}"""
if old2 in s:
    s = s.replace(old2, new)
    print("old paste replaced too")

open(P, "w").write(s)
