// jscodeshift can take a parser, like "babel", "babylon", "flow", "ts", or "tsx"
// Read more: https://github.com/facebook/jscodeshift#parser
export const parser = "babel";

// Press ctrl+space for code completion
export default function transformer(file, api) {
  const j = api.jscodeshift;
  return j(file.source)
    .find(j.Identifier)
    .forEach((path) => {
      if (path.node.name === "ajax") {
        let callExpr = path.parent.parent;
        callExpr.node.callee = j.identifier("ajax");
        if (callExpr.node.arguments.length === 1) {
          j(callExpr.node.arguments[0])
            .find(j.Identifier)
            .forEach((p) => {
              if (
                p.node.name === "success" &&
                p.parent.node.type === "Property"
              ) {
                let arg = p.parent.node.value;
                p.parent.replace();
                callExpr.replace(
                  j.callExpression(
                    j.memberExpression(callExpr.node, j.identifier("then")),
                    [arg]
                  )
                );
              }
              if (
                p.node.name === "error" &&
                p.parent.node.type === "Property"
              ) {
                let arg = p.parent.node.value;
                p.parent.replace();
                callExpr.replace(
                  j.callExpression(
                    j.memberExpression(callExpr.node, j.identifier("catch")),
                    [arg]
                  )
                );
              }
              if (
                p.node.name === "complete" &&
                p.parent.node.type === "Property"
              ) {
                let arg = p.parent.node.value;
                p.parent.replace();
                callExpr.replace(
                  j.callExpression(
                    j.memberExpression(callExpr.node, j.identifier("finally")),
                    [arg]
                  )
                );
              }
            });
        } else {
          j(callExpr.node.arguments[1])
            .find(j.Identifier)
            .forEach((p) => {
              if (
                p.node.name === "success" &&
                p.parent.node.type === "Property"
              ) {
                let arg = p.parent.node.value;
                p.parent.replace();
                callExpr.replace(
                  j.callExpression(
                    j.memberExpression(callExpr.node, j.identifier("then")),
                    [arg]
                  )
                );
              }
              if (
                p.node.name === "error" &&
                p.parent.node.type === "Property"
              ) {
                let arg = p.parent.node.value;
                p.parent.replace();
                callExpr.replace(
                  j.callExpression(
                    j.memberExpression(callExpr.node, j.identifier("catch")),
                    [arg]
                  )
                );
              }
              if (
                p.node.name === "complete" &&
                p.parent.node.type === "Property"
              ) {
                let arg = p.parent.node.value;
                p.parent.replace();
                callExpr.replace(
                  j.callExpression(
                    j.memberExpression(callExpr.node, j.identifier("finally")),
                    [arg]
                  )
                );
              }
            });
        }
      }
    })
    .toSource();
}
