# Second probe set for the native-code-limits research. Writes tests/src/probe/:
#
#   module_M      M serializers of one 100-property mixed object, for M in 10, 12, 14, 16, 18, 20, 40
#   flatmodule_M  M serializers of one 100-property `number` object, for M in 20, 40
#
# A mixed object's properties cycle through string, Vector3, CFrame, u8, boolean and an optional
# string, as in gen.py.
import os
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "tests/src/probe"
os.makedirs(ROOT, exist_ok=True)
for name in os.listdir(ROOT):
    os.remove(os.path.join(ROOT, name))

HEAD = "//!native\n//!optimize 2\nimport { DataType, createCodec } from \"@rbxts/surge\";\n\n"
MIXED = ["string", "Vector3", "CFrame", "DataType.u8", "boolean", "string | undefined"]


def mixed_props(n):
    out = []
    for i in range(n):
        kind = MIXED[i % len(MIXED)]
        out.append(f"\tm{i}?: string;" if kind == "string | undefined" else f"\tm{i}: {kind};")
    return "\n".join(out)


def write(name, body):
    with open(os.path.join(ROOT, f"{name}.ts"), "w", encoding="utf8", newline="") as f:
        f.write(HEAD + body)


for m in [10, 12, 14, 16, 18, 20, 40]:
    lines = [f"interface Shape {{\n{mixed_props(100)}\n}}"]
    lines += [f"export const codec{i} = createCodec<Shape>();" for i in range(m)]
    write(f"module_{m:02d}", "\n".join(lines) + "\n")
flat = "\n".join(f"\tf{i}: number;" for i in range(100))
for m in [20, 40]:
    lines = [f"interface Shape {{\n{flat}\n}}"]
    lines += [f"export const codec{i} = createCodec<Shape>();" for i in range(m)]
    write(f"flatmodule_{m:02d}", "\n".join(lines) + "\n")
print("wrote", len(os.listdir(ROOT)), "modules to", ROOT)
