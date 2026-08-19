import sys
path = "/home/ubuntu/ai_chat_app/.manus-logs/devserver.log"
marker = sys.argv[1] if len(sys.argv) > 1 else "debug groq"
lines = [l for l in open(path) if marker in l]
for l in lines[-3:]:
    print(repr(l[-4000:]))
    print("====")
