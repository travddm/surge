# Writes probe modules under tests/src/probe/ for the native-code-limits research: generated
# serializers of increasing size, each module `--!native` and `--!optimize 2` like a consumer's
# serializer module. Throwaway: the tree must be clean again before any committed run.
#
#   flat_N     one object of N `number` properties
#   mixed_N    one object of N properties cycling through string, Vector3, CFrame, u8, boolean
#              and an optional string
#   union_V    a tagged union of V variants, each a u32, a string, a Vector3 and a number
#   module_M   M serializers of a 100-property mixed object in one module
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
        if kind == "string | undefined":
            out.append(f"\tm{i}?: string;")
        else:
            out.append(f"\tm{i}: {kind};")
    return "\n".join(out)


def write(name, body):
    with open(os.path.join(ROOT, f"{name}.ts"), "w", encoding="utf8", newline="") as f:
        f.write(HEAD + body)


sizes = {
    "flat": [250, 500, 1000, 2000, 4000, 8000],
    "mixed": [100, 200, 400, 800, 1600, 3200],
    "union": [16, 64, 256, 1024],
    "module": [10, 20, 40, 80, 160],
}
for n in sizes["flat"]:
    props = "\n".join(f"\tf{i}: number;" for i in range(n))
    write(f"flat_{n}", f"interface Shape {{\n{props}\n}}\nexport const codec = createCodec<Shape>();\n")
for n in sizes["mixed"]:
    write(f"mixed_{n}", f"interface Shape {{\n{mixed_props(n)}\n}}\nexport const codec = createCodec<Shape>();\n")
for v in sizes["union"]:
    variants = "\n".join(
        f'\t| {{ kind: "v{i}"; id: DataType.u32; text: string; at: Vector3; amount: number }}' for i in range(v)
    )
    write(f"union_{v}", f"type Shape =\n{variants};\nexport const codec = createCodec<Shape>();\n")
for m in sizes["module"]:
    lines = [f"interface Shape {{\n{mixed_props(100)}\n}}"]
    lines += [f"export const codec{i} = createCodec<Shape>();" for i in range(m)]
    write(f"module_{m}", "\n".join(lines) + "\n")
print("wrote", len(os.listdir(ROOT)), "modules to", ROOT)
