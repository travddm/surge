# Native code limits on generated serializers

2026-10-07 · surge `ab62da5` and `9eac6b9` · rbxts-transformer-surge `afefffd`
and `024d7a4`

## Abstract

Luau's native code generation leaves a function interpreted past any of three
limits: instructions in one block, blocks in one function, and instructions in
one module. Probe modules of generated serializers of growing size, each
required in Studio, reached only the module limit. A module of serializers of
one 100-property object, whose properties cycle through six kinds, compiled
the `serialize` and `deserialize` of its first 16 serializers and the
`serialize` of the next natively, about 1,650 of those properties, and left
every one after them interpreted. A module of 4,000 `number` properties
compiled whole. No type that roblox-ts compiled within ten minutes reached
either limit on one function. Studio's output names each function left
interpreted, and the rest of the module stays native. On the way, an object
of 800 such properties failed to load at all, because its size was one chain
of additions past Luau's 255 registers; rbxts-transformer-surge `024d7a4`
fixes that (Transformer 5.20 in [specs/transformer.md](../specs/transformer.md)).

## Background

Native code generation compiles a `--!native` module's functions when the
module loads. Its defaults are 65,536 IR instructions in one block of a
function, 32,768 blocks in one function, and 1,048,576 IR instructions in one
module
([`CodeGen.cpp`](https://github.com/luau-lang/luau/blob/master/CodeGen/src/CodeGen.cpp)).
They are fast flags, which Roblox can change. A function past one stays
interpreted, and Studio reports it
([Native code generation](https://create.roblox.com/docs/luau/native-code-gen)).

The generated code of one `createCodec` call is one function for each side
(Transformer 5.2), and [performance.md](../performance.md) recommends one
`--!native` module that holds every serializer of a game. What this costs in IR
instructions grows with the type, and was not measured.

## Method

**Probe types.** [data/native-code-limits/gen.py](data/native-code-limits/gen.py)
and [gen2.py](data/native-code-limits/gen2.py) write one module for each probe,
each `--!native` and `--!optimize 2`:

- `flat_N`: one object of `N` `number` properties.
- `mixed_N`: one object of `N` properties that cycle through `string`,
  `Vector3`, `CFrame`, `DataType.u8`, `boolean` and an optional `string`.
- `union_V`: a tagged union of `V` variants, each a `u32`, a `string`, a
  `Vector3` and a `number`.
- `module_M`: `M` serializers of the 100-property mixed object in one module.
- `flatmodule_M`: `M` serializers of a 100-property `number` object in one
  module.

**Runs.** Each run compiled its probes in the tests project, built the tests
place, and ran a script in Studio through `run-in-roblox`, as the speed tier
does. The script requires each probe in turn and prints a marker before and
after it, so what Studio prints while it compiles a module lands between that
module's markers. `debug.dumpcodesize()` answered "dumpcodesize can only be
called from CommandBar", so Studio's messages are the whole reading.

| Run | Ended (UTC) | Builds                | Probes                                                                            |
| --- | ----------- | --------------------- | --------------------------------------------------------------------------------- |
| 1   | 05:27       | `ab62da5` / `afefffd` | `flat_N` to 2,000, `mixed_N` to 800, `union_16` and `union_64`, `module_M` to 40  |
| 2   | 05:31       | `ab62da5` / `afefffd` | `module_M` for 10 to 20 and 40, `flatmodule_20` and `flatmodule_40`, with timings |
| 3   | 05:56       | `9eac6b9` / `024d7a4` | `flat_4000`, `flat_8000`, `mixed_800`, `mixed_1600`, `union_256`, `module_80`     |

All three ran on 2026-10-07, on the machine of the speed tier. The runs did not
record the Roblox build; the speed run that ended at 04:27 UTC the same day
ran on 0.741.19.7411056.

**Timings.** Run 2 also timed the first and the last serializer of each
`module_M` on one value: the median of seven batches of 2,000 calls, in one
Studio process, with no control. They say which side of the limit a function
is on, and nothing finer.

**Compile time.** The first attempt compiled every probe of `gen.py` at once
and was stopped after ten minutes, with one node process at 3.2 GB. Each large
probe was then compiled alone in the tests project, with ten minutes allowed.

## Results

What native code generation printed for each probe:

| Probe                      | Properties in the module | Run  | Studio's output                                                                            |
| -------------------------- | ------------------------ | ---- | ------------------------------------------------------------------------------------------ |
| `flat_250` to `flat_4000`  | up to 4,000              | 1, 3 | nothing                                                                                    |
| `flat_8000`                | 8,000                    | 3    | `deserialize` exceeded total module instruction limit                                      |
| `flatmodule_20`, `_40`     | 2,000, 4,000             | 2    | nothing                                                                                    |
| `mixed_100` to `mixed_400` | up to 400                | 1    | nothing                                                                                    |
| `mixed_800`                | 800                      | 1    | failed to load: "Out of registers when trying to allocate 1 registers: exceeded limit 255" |
| `mixed_800`, `mixed_1600`  | 800, 1,600               | 3    | nothing                                                                                    |
| `union_16`, `_64`, `_256`  | 4 for each variant       | 1, 3 | nothing                                                                                    |
| `module_10` to `module_16` | 1,000 to 1,600           | 2    | nothing                                                                                    |
| `module_18`                | 1,800                    | 2    | 3 functions exceeded total module instruction limit                                        |
| `module_20`                | 2,000                    | 1, 2 | 7 functions                                                                                |
| `module_40`                | 4,000                    | 1, 2 | 47 functions                                                                               |
| `module_80`                | 8,000                    | 3    | 127 functions                                                                              |

Each `module_M` past the limit listed every `serialize` and `deserialize`
after its 33rd, in the order the module holds them: the 17th serializer's
`deserialize`, then both functions of each serializer after it. The message
names the module, then each function and its line, and ends
"Script will be interpreted", for example:

```text
Native code generation of script =ServerStorage.tests.probe.module_18 failed:
Native code generation failed to compile some of the module functions:
Function 'deserialize' at line 18740 exceeded total module instruction limit
...
.  Script will be interpreted.
```

Timings from run 2, in microseconds a call:

| Module      | Serializer | Encode | Decode | Past the limit |
| ----------- | ---------- | ------ | ------ | -------------- |
| `module_10` | `codec0`   | 3.04   | 6.45   | no             |
| `module_10` | `codec9`   | 3.38   | 6.78   | no             |
| `module_16` | `codec0`   | 3.58   | 5.89   | no             |
| `module_16` | `codec15`  | 3.29   | 5.84   | no             |
| `module_18` | `codec0`   | 3.23   | 5.26   | no             |
| `module_18` | `codec17`  | 3.79   | 7.10   | yes            |
| `module_20` | `codec0`   | 3.16   | 5.54   | no             |
| `module_20` | `codec19`  | 3.78   | 7.08   | yes            |
| `module_40` | `codec0`   | 2.80   | 5.83   | no             |
| `module_40` | `codec39`  | 3.73   | 7.03   | yes            |

Compiled alone, `flat_4000` took 29 s, `module_80` 38 s, `union_256` 54 s,
`mixed_1600` 60 s and `flat_8000` 88 s. `union_1024` had not finished after
600 s.

## Discussion

The module limit is the one a game reaches. It counts every function of the
module, both sides of every serializer, so it bounds the properties of all
the module's serializers together: about 1,650 of the mixed properties here,
and between 4,000 and 8,000 `number` properties. What one property costs
depends on its kind, and the probe measured two mixes, not each kind. A game
that keeps every serializer in one module, as performance.md recommends,
reaches it with a dozen serializers of 100 properties.

Past the limit, only the functions Studio lists run interpreted. The first
serializer of `module_40` times like the first of `module_10`, and the
serializers past the limit are slower than every serializer before it, by
about 1.2× on both halves in these timings. The message's
closing "Script will be interpreted" does not describe what ran.

Neither limit on one function was reached. 8,000 `number` properties in one
`serialize` compiled natively, and so did a union of 256 variants. A larger
type has to get through roblox-ts first, and a union of 1,024 variants did not
compile in ten minutes.

The register failure is a limit of the Luau compiler, not of native code
generation: it fails the module when it loads, natively compiled or not. The
size of a shape sized exactly (Transformer 5.20) was one chain of additions,
one term for each string's length and each optional's bytes, and Luau holds a
register for each level of such a chain. `024d7a4` sums at most 32 terms in
one chain and adds the chains in pairs, and run 3 loaded `mixed_800` and
`mixed_1600`.

This does not reach a live server: whether it applies the same flags, and
whether it reports a function left interpreted, is not measured. Nor does it
reach the game's limit on the total size of its native code, which no probe
here was large enough to find.

## Conclusion

A module of generated serializers reaches native code generation's module
instruction limit at about 1,650 properties of a mix of kinds, and the
functions past it run interpreted, about 1.2× slower in these timings, while
the rest of the module stays native. Studio's output names each one, so
splitting serializers across modules is the remedy, and it is the game's to
make. No type that roblox-ts compiles in reasonable time reaches either limit
on one function.

## Data

- [data/native-code-limits/](data/native-code-limits/): `gen.py` and
  `gen2.py`, which write the probes; `probe.server.luau`, the script of runs
  1 and 3, and `probe2.server.luau`, the script of run 2; `run1.log` to
  `run3.log`, what `run-in-roblox` printed; and `compile-times.log`.
- Run 1 compiled every probe of `gen.py` but `flat_4000`, `flat_8000`,
  `mixed_1600`, `mixed_3200`, `union_256`, `union_1024`, `module_80` and
  `module_160`, and run 3 compiled the six it names, from the same script.
