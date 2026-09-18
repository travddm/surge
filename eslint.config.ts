import eslint from "@eslint/js";
import type { Linter } from "eslint";
import { flatConfigs as importXConfigs } from "eslint-plugin-import-x";
import prettierConfig from "eslint-plugin-prettier/recommended";
import roblox, { configs as robloxConfigs } from "eslint-plugin-roblox-ts";
import { configs as tseslintConfigs } from "typescript-eslint";

export default [
	eslint.configs.recommended,
	...tseslintConfigs.recommended,
	prettierConfig,
	importXConfigs.recommended,
	importXConfigs.typescript,
	{
		ignores: ["**/out/**", "**/node_modules/**", "**/include/**", "**/dist/**", "eslint.config.ts"],
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parserOptions: {
				ecmaVersion: 2018,
				sourceType: "module",
				projectService: true,
				tsconfigRootDir: __dirname,
			},
		},
		rules: {
			"@typescript-eslint/no-unused-vars": "off",
			"prettier/prettier": "warn",
			// TypeScript already verifies imports, and this rule misreports modules
			// that use `export =`.
			"import-x/default": "off",
		},
	},
	{
		// src/ (this package) and tests/ are both roblox-ts-compiled: `any` is
		// banned outright, and roblox-ts's own macro-usage rules apply.
		files: ["src/**/*.ts", "tests/**/*.ts"],
		plugins: {
			"roblox-ts": roblox,
		},
		rules: {
			...robloxConfigs.recommended.rules,
			"roblox-ts/no-any": ["error", { fixToUnknown: true }],
		},
	},
	{
		// The plain Node/ESM script that turns the Lune test runner's sentinel
		// output into a process exit code (see testing.md), outside any tsconfig.
		files: ["tests/scripts/*.mjs"],
		languageOptions: {
			sourceType: "module",
			globals: {
				process: "readonly",
				console: "readonly",
				setTimeout: "readonly",
				clearTimeout: "readonly",
			},
		},
	},
] satisfies Linter.Config[];
