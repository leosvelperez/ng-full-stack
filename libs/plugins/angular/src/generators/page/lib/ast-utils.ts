import { applyChangesToString, ChangeType, Tree } from '@nrwl/devkit';
import { insertChange } from '@nrwl/workspace/src/utilities/ast-utils';
import { findNodes } from '@nrwl/workspace/src/utilities/typescript/find-nodes';
import { getSourceNodes } from '@nrwl/workspace/src/utilities/typescript/get-source-nodes';
import * as ts from 'typescript';

type NestModuleDecoratorProperty = 'imports' | 'providers' | 'controllers';

export function insertNestModuleProperty(
  tree: Tree,
  modulePath: string,
  name: string,
  property: NestModuleDecoratorProperty
) {
  const contents = tree.read(modulePath).toString('utf-8');

  const sourceFile = ts.createSourceFile(
    modulePath,
    contents,
    ts.ScriptTarget.Latest,
    true
  );

  const commonImport = findImport(sourceFile, '@nestjs/common');

  if (!commonImport) {
    throw new Error(
      `There are no imports from "@nestjs/common" in ${modulePath}.`
    );
  }

  const nestModuleNamedImport = getNamedImport(commonImport, 'Module');

  const nestModuleName = nestModuleNamedImport.name.escapedText;

  const nestModuleClassDeclaration = findDecoratedClass(
    sourceFile,
    nestModuleName
  );

  const nestModuleDecorator = nestModuleClassDeclaration.decorators.find(
    (decorator) =>
      ts.isCallExpression(decorator.expression) &&
      ts.isIdentifier(decorator.expression.expression) &&
      decorator.expression.expression.escapedText === nestModuleName
  );

  const nestModuleCall = nestModuleDecorator.expression as ts.CallExpression;

  if (nestModuleCall.arguments.length < 1) {
    const newContents = applyChangesToString(contents, [
      {
        type: ChangeType.Insert,
        index: nestModuleCall.getEnd() - 1,
        text: `{ ${property}: [${name}]}`,
      },
    ]);
    tree.write(modulePath, newContents);
  } else {
    if (!ts.isObjectLiteralExpression(nestModuleCall.arguments[0])) {
      throw new Error(
        `The Nest Module options for ${nestModuleClassDeclaration.name.escapedText} in ${modulePath} is not an object literal.`
      );
    }

    const nestModuleOptions = nestModuleCall
      .arguments[0] as ts.ObjectLiteralExpression;

    const typeProperty = findPropertyAssignment(nestModuleOptions, property);

    if (!typeProperty) {
      let text = `${property}: [${name}]`;
      if (nestModuleOptions.properties.hasTrailingComma) {
        text = `${text},`;
      } else {
        text = `, ${text}`;
      }
      const newContents = applyChangesToString(contents, [
        {
          type: ChangeType.Insert,
          index: nestModuleOptions.getEnd() - 1,
          text,
        },
      ]);
      tree.write(modulePath, newContents);
    } else {
      if (!ts.isArrayLiteralExpression(typeProperty.initializer)) {
        throw new Error(
          `The Nest Module ${property} for ${nestModuleClassDeclaration.name.escapedText} in ${modulePath} is not an array literal`
        );
      }

      let text: string;
      if (typeProperty.initializer.elements.hasTrailingComma) {
        text = `${name},`;
      } else if (!typeProperty.initializer.elements.length) {
        text = `${name}`;
      } else {
        text = `, ${name}`;
      }
      const newContents = applyChangesToString(contents, [
        {
          type: ChangeType.Insert,
          index: typeProperty.initializer.getEnd() - 1,
          text,
        },
      ]);
      tree.write(modulePath, newContents);
    }
  }
}

export function insertNestModuleController(
  tree: Tree,
  modulePath: string,
  controllerName: string
) {
  insertNestModuleProperty(tree, modulePath, controllerName, 'controllers');
}

function findImport(sourceFile: ts.SourceFile, importPath: string) {
  const importStatements = sourceFile.statements.filter(ts.isImportDeclaration);

  return importStatements.find(
    (statement) =>
      statement.moduleSpecifier
        .getText(sourceFile)
        .replace(/['"`]/g, '')
        .trim() === importPath
  );
}

function getNamedImport(coreImport: ts.ImportDeclaration, importName: string) {
  if (!ts.isNamedImports(coreImport.importClause.namedBindings)) {
    throw new Error(
      `The import from ${coreImport.moduleSpecifier} does not have named imports.`
    );
  }

  return coreImport.importClause.namedBindings.elements.find((namedImport) =>
    namedImport.propertyName
      ? ts.isIdentifier(namedImport.propertyName) &&
        namedImport.propertyName.escapedText === importName
      : ts.isIdentifier(namedImport.name) &&
        namedImport.name.escapedText === importName
  );
}

function findDecoratedClass(
  sourceFile: ts.SourceFile,
  ngModuleName: ts.__String
) {
  const classDeclarations = sourceFile.statements.filter(ts.isClassDeclaration);
  return classDeclarations.find(
    (declaration) =>
      declaration.decorators &&
      declaration.decorators.some(
        (decorator) =>
          ts.isCallExpression(decorator.expression) &&
          ts.isIdentifier(decorator.expression.expression) &&
          decorator.expression.expression.escapedText === ngModuleName
      )
  );
}

function findPropertyAssignment(
  ngModuleOptions: ts.ObjectLiteralExpression,
  propertyName: NestModuleDecoratorProperty
) {
  return ngModuleOptions.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.escapedText === propertyName
  ) as ts.PropertyAssignment;
}

export function addRoute(
  host: Tree,
  ngModulePath: string,
  source: ts.SourceFile,
  route: string
): ts.SourceFile {
  const routes = getListOfRoutes(source);
  if (!routes) return source;

  if (routes.hasTrailingComma || routes.length === 0) {
    return insertChange(host, source, ngModulePath, routes.end, route);
  } else {
    return insertChange(host, source, ngModulePath, routes.end, `, ${route}`);
  }
}

function getListOfRoutes(
  source: ts.SourceFile
): ts.NodeArray<ts.Expression> | null {
  const imports: any = getMatchingProperty(
    source,
    'imports',
    'NgModule',
    '@angular/core'
  );

  if (imports?.initializer.kind === ts.SyntaxKind.ArrayLiteralExpression) {
    const a = imports.initializer as ts.ArrayLiteralExpression;

    for (const e of a.elements) {
      if (e.kind === ts.SyntaxKind.CallExpression) {
        const ee = e as ts.CallExpression;
        const text = ee.expression.getText(source);
        if (
          (text === 'RouterModule.forRoot' ||
            text === 'RouterModule.forChild') &&
          ee.arguments.length > 0
        ) {
          const routes = ee.arguments[0];
          if (routes.kind === ts.SyntaxKind.ArrayLiteralExpression) {
            return (routes as ts.ArrayLiteralExpression).elements;
          } else if (routes.kind === ts.SyntaxKind.Identifier) {
            // find the array expression
            const variableDeclarations = findNodes(
              source,
              ts.SyntaxKind.VariableDeclaration
            ) as ts.VariableDeclaration[];

            const routesDeclaration = variableDeclarations.find((x) => {
              return x.name.getText() === routes.getText();
            });

            if (routesDeclaration) {
              return (
                routesDeclaration.initializer as ts.ArrayLiteralExpression
              ).elements;
            }
          }
        }
      }
    }
  }
  return null;
}

function getMatchingProperty(
  source: ts.SourceFile,
  property: string,
  identifier: string,
  module: string
): ts.ObjectLiteralElement {
  const nodes = getDecoratorMetadata(source, identifier, module);
  const node: any = nodes[0]; // tslint:disable-line:no-any

  if (!node) return null;

  // Get all the children property assignment of object literals.
  return getMatchingObjectLiteralElement(node, source, property);
}

function getMatchingObjectLiteralElement(
  node: any,
  source: ts.SourceFile,
  property: string
) {
  return (
    (node as ts.ObjectLiteralExpression).properties
      .filter((prop) => prop.kind == ts.SyntaxKind.PropertyAssignment)
      // Filter out every fields that's not "metadataField". Also handles string literals
      // (but not expressions).
      .filter((prop: ts.PropertyAssignment) => {
        const name = prop.name;
        switch (name.kind) {
          case ts.SyntaxKind.Identifier:
            return (name as ts.Identifier).getText(source) === property;
          case ts.SyntaxKind.StringLiteral:
            return (name as ts.StringLiteral).text === property;
        }
        return false;
      })[0]
  );
}

function getDecoratorMetadata(
  source: ts.SourceFile,
  identifier: string,
  module: string
): ts.Node[] {
  const angularImports: { [name: string]: string } = findNodes(
    source,
    ts.SyntaxKind.ImportDeclaration
  )
    .map((node: ts.ImportDeclaration) => _angularImportsFromNode(node, source))
    .reduce(
      (
        acc: { [name: string]: string },
        current: { [name: string]: string }
      ) => {
        for (const key of Object.keys(current)) {
          acc[key] = current[key];
        }

        return acc;
      },
      {}
    );

  return getSourceNodes(source)
    .filter((node) => {
      return (
        node.kind == ts.SyntaxKind.Decorator &&
        (node as ts.Decorator).expression.kind == ts.SyntaxKind.CallExpression
      );
    })
    .map((node) => (node as ts.Decorator).expression as ts.CallExpression)
    .filter((expr) => {
      if (expr.expression.kind == ts.SyntaxKind.Identifier) {
        const id = expr.expression as ts.Identifier;

        return (
          id.getFullText(source) == identifier &&
          angularImports[id.getFullText(source)] === module
        );
      } else if (
        expr.expression.kind == ts.SyntaxKind.PropertyAccessExpression
      ) {
        // This covers foo.NgModule when importing * as foo.
        const paExpr = expr.expression as ts.PropertyAccessExpression;
        // If the left expression is not an identifier, just give up at that point.
        if (paExpr.expression.kind !== ts.SyntaxKind.Identifier) {
          return false;
        }

        const id = paExpr.name.text;
        const moduleId = (paExpr.expression as ts.Identifier).getText(source);

        return id === identifier && angularImports[`${moduleId}.`] === module;
      }

      return false;
    })
    .filter(
      (expr) =>
        expr.arguments[0] &&
        expr.arguments[0].kind == ts.SyntaxKind.ObjectLiteralExpression
    )
    .map((expr) => expr.arguments[0] as ts.ObjectLiteralExpression);
}

function _angularImportsFromNode(
  node: ts.ImportDeclaration,
  _sourceFile: ts.SourceFile
): { [name: string]: string } {
  const ms = node.moduleSpecifier;
  let modulePath: string;
  switch (ms.kind) {
    case ts.SyntaxKind.StringLiteral:
      modulePath = (ms as ts.StringLiteral).text;
      break;
    default:
      return {};
  }

  if (!modulePath.startsWith('@angular/')) {
    return {};
  }

  if (node.importClause) {
    if (node.importClause.name) {
      // This is of the form `import Name from 'path'`. Ignore.
      return {};
    } else if (node.importClause.namedBindings) {
      const nb = node.importClause.namedBindings;
      if (nb.kind == ts.SyntaxKind.NamespaceImport) {
        // This is of the form `import * as name from 'path'`. Return `name.`.
        return {
          [`${(nb as ts.NamespaceImport).name.text}.`]: modulePath,
        };
      } else {
        // This is of the form `import {a,b,c} from 'path'`
        const namedImports = nb as ts.NamedImports;

        return namedImports.elements
          .map((is: ts.ImportSpecifier) =>
            is.propertyName ? is.propertyName.text : is.name.text
          )
          .reduce((acc: { [name: string]: string }, curr: string) => {
            acc[curr] = modulePath;

            return acc;
          }, {});
      }
    }

    return {};
  } else {
    // This is of the form `import 'path';`. Nothing to do.
    return {};
  }
}
