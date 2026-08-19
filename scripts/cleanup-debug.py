import re

p = "/home/ubuntu/ai_chat_app/server/index.ts"
src = open(p).read()

# Remove debug-groq route block (from its comment to the next blank-line section)
pattern = re.compile(r"\n// ── TEMP debug route: call groq directly.*?^\}\);\n", re.S | re.M)
src2, n1 = pattern.subn("\n", src)
print("route removed:", n1)

# Remove dbg-groq-in log line
line = '  if (providerKey === "groq") console.log("[dbg-groq-in] received apiKey first8:", (apiKey || "").slice(0,8), "len:", (apiKey||"").length, "modelId:", modelId);\n'
src2, n2 = src2.split(line)[0] + src2.split(line)[1] if line in src2 else (src2, 0)
print("in-log removed:", int(line in src2) ^ 1)

# Remove the stdout.write debug block
pattern2 = re.compile(r'\n      // DEBUG: inspect why upstream rejected \(temporary\)\n      if \(providerKey === "groq"\) \{\n        process\.stdout\.write\(\[^\n]+\n      \}\n')
src2, n3 = pattern2.subn("\n", src2)
print("failure-log removed:", n3)

open(p, "w").write(src2)
print("final debug occurrences:", src2.count("debug"))
