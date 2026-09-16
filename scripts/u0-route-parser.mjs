import ts from 'typescript';

// Inspect rendered children only. Traversing JSX attributes would mistake a
// Suspense fallback (or a drawer's preview) for the route's actual screen.
export function extractRoutes(source) {
  const ast = ts.createSourceFile(
    'App.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const routes = [];
  const opening = (node) =>
    ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
  const attribute = (element, name) =>
    element.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(ast) === name);
  const rendered = (node) => {
    if (!node) return null;
    if (ts.isJsxExpression(node)) return rendered(node.expression);
    if (ts.isParenthesizedExpression(node)) return rendered(node.expression);
    const element = opening(node);
    if (element && element.tagName.getText(ast) !== 'Suspense') return element;
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      for (const child of node.children) {
        const result = rendered(child);
        if (result) return result;
      }
    }
    return null;
  };
  function walk(node, prefix = '', guards = []) {
    const element = opening(node);
    let next = prefix;
    let nextGuards = guards;
    if (element?.tagName.getText(ast) === 'Route') {
      const p = attribute(element, 'path')?.initializer;
      const index = Boolean(attribute(element, 'index'));
      if (p && !ts.isStringLiteral(p))
        throw new Error('Dynamic route path requires explicit audit');
      if (p) next = p.text.startsWith('/') ? p.text : `${prefix}/${p.text}`;
      const screen = rendered(attribute(element, 'element')?.initializer);
      if (!screen)
        throw new Error(
          `Unresolved route element at line ${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}`,
        );
      const component = screen.tagName.getText(ast);
      const props = Object.fromEntries(
        screen.attributes.properties.map((a) => {
          if (!ts.isJsxAttribute(a)) throw new Error('Spread route props require explicit audit');
          return [
            a.name.getText(ast),
            a.initializer
              ? ts.isStringLiteral(a.initializer)
                ? a.initializer.text
                : a.initializer.getText(ast)
              : true,
          ];
        }),
      );
      if (!p && !index) nextGuards = [...guards, { component, props }];
      else
        routes.push({
          route: next || '/',
          index,
          component,
          props,
          guards,
          redirectTo: component === 'Navigate' ? (props.to ?? null) : null,
          line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
        });
    }
    ts.forEachChild(node, (child) => walk(child, next, nextGuards));
  }
  walk(ast);
  return routes;
}
