export type FormatParser = "babel" | "estree" | "html" | "postcss";

export interface FormatSettings {
  parser: string;
  plugins: FormatParser[];
  printWidth: number;
  tabWidth: number;
  semi?: boolean;
  singleQuote?: boolean;
}

const PLUGIN_LOADERS: Record<FormatParser, () => Promise<unknown>> = {
  babel: () => import("prettier/plugins/babel"),
  estree: () => import("prettier/plugins/estree"),
  html: () => import("prettier/plugins/html"),
  postcss: () => import("prettier/plugins/postcss"),
};

export async function formatCode(code: string, settings: FormatSettings): Promise<string> {
  const [prettierMod, ...pluginMods] = await Promise.all([
    import("prettier/standalone"),
    ...settings.plugins.map((p) => PLUGIN_LOADERS[p]()),
  ]);
  const prettier = prettierMod as unknown as {
    format: (code: string, opts: Record<string, unknown>) => unknown;
  };
  const plugins = pluginMods.map((m) => {
    const mod = m as { default?: unknown };
    return mod.default ?? m;
  });
  const { parser, printWidth, tabWidth, semi, singleQuote } = settings;
  const result = await prettier.format(code, {
    parser,
    printWidth,
    tabWidth,
    semi,
    singleQuote,
    plugins,
  });
  return String(result);
}