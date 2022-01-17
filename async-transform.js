// module.exports.parser const parser = "babel";

function findParent(path, condition, excludeCondition) {
  if (excludeCondition && excludeCondition(path)) {
    return;
  }

  if (condition(path)) {
    return path;
  } else {
    if (path.parent) {
      return findParent(path.parent, condition, excludeCondition);
    }
  }
}

function isPromise(path) {
  let isThen =
    path.node.callee &&
    path.node.callee.property &&
    path.node.callee.property.name === "then";

  let isPromise =
    path.node.callee &&
    (path.node.callee.name === "Promise" ||
      path.node.callee.property.name === "Promise");

  return isPromise || isThen;
}

function getArrowFunctionFromThen(path) {
  if (path.parent) {
    if (path.parent.node.type === "CallExpression") {
      return path.parent.node.arguments[0];
    } else {
      return getArrowFunctionFromThen(path.parent);
    }
  }
}

function addAsyncIfNeeded(j, path) {
  let arrowFunc = findParent(
    path,
    (p) =>
      p.node.type === "ArrowFunctionExpression" ||
      p.node.type === "FunctionExpression"
  );

  if (arrowFunc) {
    if (arrowFunc.parent && isPromise(arrowFunc.parent)) {
      return addAsyncIfNeeded(j, arrowFunc.parent);
    } else {
      arrowFunc.node.async = true;
      return true;
    }
  }

  return false;
}

function replace(j, path, nodes) {
  let b = j(path.replace(nodes[0]));
  for (let i = nodes.length - 1; i >= 1; i--) {
    b = b.insertAfter(nodes[i]);
  }

  return b;
}

function insertBefore(j, path, nodes) {
  let result;
  let b = path.insertBefore(nodes[0]);
  result = b;
  for (let i = nodes.length - 1; i >= 1; i--) {
    result = j(b).insertAfter(nodes[i]);
  }

  return result;
}

function replaceResolveReject(j, func, resolveFunction, rejectFunction) {
  j(func)
    .find(j.Identifier)
    .forEach((path) => {
      if (resolveFunction && path.node.name === resolveFunction) {
        let statement = findParent(path, (p) =>
          p.node.type.endsWith("Statement")
        );
        let callExpression = findParent(
          path,
          (p) => p.node.type === "CallExpression"
        );

        if (statement && callExpression) {
          let returnNode = callExpression.node.arguments[0];
          let newReturnStatement = j.returnStatement(returnNode ?? null);
          statement.replace(newReturnStatement);
        }
      } else if (rejectFunction && path.node.name === rejectFunction) {
        let statement = findParent(path, (p) =>
          p.node.type.endsWith("Statement")
        );
        let callExpression = findParent(
          path,
          (p) => p.node.type === "CallExpression"
        );

        if (statement && callExpression) {
          let catchClause = findParent(
            statement,
            (p) => p.node.type === "CatchClause"
          );
          let throwNode =
            callExpression.node.arguments[0] ??
            catchClause?.node?.param ??
            j.identifier("err_tmp");
          statement.replace(j.throwStatement(throwNode));
        }
      }
    });
}

function parseThenExpressions(j, path) {
  let callExpressions = [];
  while (true) {
    path = findParent(
      path.parent,
      (p) => p.node.type === "CallExpression",
      (p) => p.node.type.endsWith("Statement")
    );
    if (path) {
      callExpressions.push(path);
    } else {
      break;
    }
  }
  return callExpressions;
}

function replaceReturnInThen(j, nodes, propertyName) {
  j(nodes)
    .find(j.ReturnStatement)
    .forEach((path) => {
      if (
        path.node.type === "ReturnStatement" &&
        path.node.argument?.callee?.property?.name !== "then" &&
        path.node.argument?.callee?.property?.name !== "catch" &&
        path.node.argument?.callee?.property?.name !== "finally"
      ) {
        let parentFunc = findParent(
          path,
          (p) =>
            p.node.type === "ArrowFunctionExpression" ||
            p.node.type === "FunctionExpression" ||
            p.node.type === "FunctionDeclaration"
        );
        if (!parentFunc.parent) {
          let res = j.variableDeclaration("let", [
            j.variableDeclarator(
              j.identifier(propertyName),
              path.node.argument
            ),
          ]);
          path.replace(res);
        }
      }
    });
}

function getBody(j, func) {
  if (func.body && func.body.body) {
    return func.body.body;
  } else {
    return [j.expressionStatement(func.body)];
  }
}

let thenIndex = 0;
function refactorThen(j, func, onlyReturn, rejectFunctionName) {
  let done = false;
  j(func)
    .find(j.Identifier)
    .forEach((path) => {
      if (done) {
        return;
      }
      if (path.node.name === "then") {
        let returnStatement = onlyReturn
          ? findParent(
              path,
              (p) => p.node.type === "ReturnStatement",
              (p) => p.node.type === "ExpressionStatement"
            )
          : findParent(path, (p) => p.node.type === "ExpressionStatement");
        if (returnStatement) {
          thenIndex++;
          //it is return statement so it can be refactored
          let expressions = parseThenExpressions(j, path);
          let firstCall = expressions[0].node.callee.object;
          let wait = j.awaitExpression(firstCall);
          if (
            expressions.length > 0 &&
            (!expressions[0].node.arguments[0].params ||
              expressions[0].node.arguments[0]?.params?.length > 0)
          ) {
            wait = j.variableDeclaration("let", [
              j.variableDeclarator(
                j.identifier(
                  expressions[0].node.arguments[0].params?.[0]?.name ??
                    `res_${thenIndex}_${0}`
                ),
                wait
              ),
            ]);
          } else {
            wait = j.expressionStatement(wait);
          }
          let nodes = [wait];
          //add then, catch, finally statements
          for (let i = 0; i < expressions.length; i++) {
            let isArrowExpression =
              expressions[i].node.arguments[0].type ===
                "ArrowFunctionExpression" ||
              expressions[i].node.arguments[0].type === "FunctionExpression";
            let isArrowExpression2 =
              expressions[i].node.arguments[1]?.type ===
                "ArrowFunctionExpression" ||
              expressions[i].node.arguments[1]?.type === "FunctionExpression";
            if (i !== expressions.length - 1) {
              let isNextArrowExpression =
                expressions[i + 1].node.arguments[0].type ===
                  "ArrowFunctionExpression" ||
                expressions[i + 1].node.arguments[0].type ===
                  "FunctionExpression";
              if (isNextArrowExpression) {
                //let result =aaaa instead of return aaaa;
                replaceReturnInThen(
                  j,
                  expressions[i].node.arguments[0],
                  expressions[i + 1].node.arguments[0].params[0]?.name,
                  func
                );
              }
            }
            if (expressions[i].node.callee.property.name === "then") {
              let tmpNodes = [];
              if (isArrowExpression) {
                tmpNodes = getBody(j, expressions[i].node.arguments[0]);
              } else {
                let isArrowExpressionPlus1 =
                  expressions[i + 1]?.node?.arguments?.[0]?.type ===
                    "ArrowFunctionExpression" ||
                  expressions[i + 1]?.node?.arguments?.[0]?.type ===
                    "FunctionExpression";

                let onlyThens = expressions.filter(
                  (e) => e.node.callee.property.name === "then"
                );
                tmpNodes = [
                  onlyReturn &&
                  expressions[i] === onlyThens[onlyThens.length - 1]
                    ? j.returnStatement(
                        j.awaitExpression(
                          j.callExpression(expressions[i].node.arguments[0], [
                            j.identifier(`res_${thenIndex}_${i}`),
                          ])
                        )
                      )
                    : expressions[i] === onlyThens[onlyThens.length - 1]
                    ? j.expressionStatement(
                        j.awaitExpression(
                          j.callExpression(expressions[i].node.arguments[0], [
                            j.identifier(`res_${thenIndex}_${i}`),
                          ])
                        )
                      )
                    : j.variableDeclaration("let", [
                        j.variableDeclarator(
                          isArrowExpressionPlus1
                            ? expressions[i + 1].node.arguments[0].params[0] ??
                                j.identifier(`res_${thenIndex}_${i + 1}`)
                            : j.identifier(`res_${thenIndex}_${i + 1}`),
                          j.awaitExpression(
                            j.callExpression(expressions[i].node.arguments[0], [
                              j.identifier(`res_${thenIndex}_${i}`),
                            ])
                          )
                        ),
                      ]),
                ];
              }
              tmpNodes.forEach((n) => nodes.push(n));
              if (
                expressions[i].node.arguments.length === 2 &&
                !(
                  !isArrowExpression2 &&
                  expressions[i].node.arguments[1].name === rejectFunctionName
                )
              ) {
                let tryNode = j.tryStatement(
                  j.blockStatement(nodes),
                  j.catchClause(
                    j.identifier(
                      expressions[i].node.arguments[1]?.params?.[0]?.name ??
                        `err_tmp`
                    ),
                    null,
                    j.blockStatement(
                      isArrowExpression2
                        ? getBody(j, expressions[i].node.arguments[1])
                        : [
                            j.returnStatement(
                              j.awaitExpression(
                                j.callExpression(
                                  expressions[i].node.arguments[1],
                                  [j.identifier(`err_tmp`)]
                                )
                              )
                            ),
                          ]
                    )
                  )
                );
                nodes = [tryNode];
              }
            } else if (expressions[i].node.callee.property.name === "catch") {
              if (
                !(
                  !isArrowExpression &&
                  expressions[i].node.arguments[0].name === rejectFunctionName
                )
              ) {
                let tryNode = j.tryStatement(
                  j.blockStatement(nodes),
                  j.catchClause(
                    j.identifier(
                      expressions[i].node.arguments[0]?.params?.[0]?.name ??
                        `err_tmp`
                    ),
                    null,
                    j.blockStatement(
                      isArrowExpression
                        ? getBody(j, expressions[i].node.arguments[0])
                        : [
                            j.returnStatement(
                              j.awaitExpression(
                                j.callExpression(
                                  j.identifier(
                                    expressions[i].node.arguments[0].name
                                  ),
                                  [j.identifier(`err_tmp`)]
                                )
                              )
                            ),
                          ]
                    )
                  )
                );
                nodes = [tryNode];
              }
            } else if (expressions[i].node.callee.property.name === "finally") {
              let tryNode = j.tryStatement(
                j.blockStatement(nodes),
                null,
                j.blockStatement(
                  isArrowExpression
                    ? getBody(j, expressions[i].node.arguments[0])
                    : [
                        j.expressionStatement(
                          j.callExpression(
                            j.identifier(expressions[i].node.arguments[0].name),
                            []
                          )
                        ),
                      ]
                )
              );
              nodes = [tryNode];
            }
          }
          replace(j, returnStatement, nodes);
          refactorThen(j, func, false, rejectFunctionName);
          done = true;
        }
      }
    });
}

function refactorNewPromise(j, func, returnStatement) {
  //get new expression
  let arrowFunc = returnStatement.node.argument.arguments[0];
  let resolveFunction = arrowFunc.params[0]?.name;
  let rejectFunction = arrowFunc.params[1]?.name;
  refactorThen(j, arrowFunc, false, rejectFunction);
  replaceResolveReject(j, arrowFunc, resolveFunction, rejectFunction);
  let newNodes = getBody(j, arrowFunc);
  replace(j, returnStatement, newNodes);
}

module.exports = function transformer(file, api) {
  const j = api.jscodeshift;
  let ast1 = j(file.source);

  return ast1
    .find(j.Identifier)
    .forEach((path) => {
      if (path.node.name === "Promise" || path.node.name === "then") {
        let returnStatement = findParent(
          path,
          (p) => p.node.type === "ReturnStatement",
          (p) =>
            p.node.type === "ExpressionStatement" ||
            p.node.type === "VariableDeclaration"
        );
        let a = ast1;
        if (returnStatement) {
          let func = findParent(
            returnStatement,
            (p) =>
              p.node.type === "FunctionExpression" ||
              p.node.type === "FunctionDeclaration" ||
              p.node.type === "ArrowFunctionExpression"
          );
          if (func) {
            func.node.async = true;
            if (path.node.name === "Promise") {
              refactorNewPromise(j, func, returnStatement);
            } else {
              refactorThen(j, func, true);
            }
          }
        }
      }
    })
    .toSource();

  // let ast2 = j(source1);
  // let source2 = source1
  //   .find(j.Identifier)
  //   .forEach((path) => {
  //     //new Promise((resolve, reject)=>{})
  //     if (path.node.name === "Promise") {
  //       let statement = findParent(path, (p) =>
  //         p.node.type.endsWith("Statement")
  //       );
  //       if (statement.node.type === "ReturnStatement") {
  //         let promiseConstructorArgument = statement.node.argument.arguments[0];
  //         if (
  //           promiseConstructorArgument.type === "functionExpression" ||
  //           promiseConstructorArgument.type === "ArrowFunctionExpression"
  //         ) {
  //           replace(j, statement, promiseConstructorArgument.body.body);
  //         }
  //       }
  //     }
  //   })
  //   .toSource();

  // let ast3 = j(source2);
  // //.then, .catch
  // source3 = ast3
  //   .find(j.Identifier)
  //   .forEach((path) => {
  //     if (path.node.name === "then") {
  //       let callExpr = findParent(
  //         path,
  //         (p) => p.node.type === "CallExpression"
  //       );
  //       let success = callExpr.node.arguments[0];
  //       let error = callExpr.node.arguments[1];
  //       let statement = findParent(path, (p) =>
  //         p.node.type.endsWith("Statement")
  //       );
  //       j.variableDeclaration("let", [
  //         j.awaitExpression(path.parent.node.object),
  //       ]);
  //       insertBefore(j, statement, success.body.body);
  //     }
  //   })
  //   .toSource();

  return source2;
};
