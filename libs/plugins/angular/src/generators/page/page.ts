import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  normalizePath,
  readProjectConfiguration,
  readWorkspaceConfiguration,
  Tree,
} from '@nrwl/devkit';
import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';
import { dirname, relative } from 'path';
import * as ts from 'typescript';
import { addRoute, insertNestModuleController } from './lib/ast-utils';
import { NormalizedSchema, Schema } from './schema';

export async function pageGenerator(
  tree: Tree,
  rawOptions: Schema
): Promise<void> {
  const options = normalizeOptions(tree, rawOptions);

  await generatePage(tree, options);
  generateController(tree, options);

  await formatFiles(tree);
}

export default pageGenerator;

async function generatePage(
  tree: Tree,
  options: NormalizedSchema
): Promise<void> {
  const pageDir = joinPathFragments(
    options.projectRoot,
    'pages',
    options.path ?? ''
  );

  generateFiles(tree, joinPathFragments(__dirname, 'files', 'page'), pageDir, {
    ...options.names,
    tmpl: '',
  });

  const appModulePath = joinPathFragments(
    options.projectRoot,
    'bootstrap',
    'client',
    'app.module.ts'
  );
  const moduleSource = tree.read(appModulePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    appModulePath,
    moduleSource,
    ts.ScriptTarget.Latest,
    true
  );

  const importPath = normalizePath(
    relative(
      dirname(appModulePath),
      joinPathFragments(pageDir, `${options.names.fileName}.component`)
    )
  );
  addRoute(
    tree,
    appModulePath,
    sourceFile,
    `{ path: '${
      names(options.names.fileName).fileName
    }', loadChildren: () => import('${importPath}').then(module => module.${
      options.names.className
    }ComponentModule) }`
  );
}

function generateController(tree: Tree, options: NormalizedSchema): void {
  const controllerDir = joinPathFragments(
    options.projectRoot,
    'api',
    options.path ?? ''
  );

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files', 'controller'),
    controllerDir,
    {
      ...options.names,
      tmpl: '',
    }
  );

  const apiModulePath = joinPathFragments(
    options.projectRoot,
    'bootstrap',
    'api',
    'app.module.ts'
  );
  const moduleSource = tree.read(apiModulePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    apiModulePath,
    moduleSource,
    ts.ScriptTarget.Latest,
    true
  );

  const importPath = normalizePath(
    relative(
      dirname(apiModulePath),
      joinPathFragments(controllerDir, `${options.names.fileName}.controller`)
    )
  );

  insertImport(
    tree,
    sourceFile,
    apiModulePath,
    `${options.names.className}Controller`,
    importPath
  );
  insertNestModuleController(
    tree,
    apiModulePath,
    `${options.names.className}Controller`
  );
}

function normalizeOptions(tree: Tree, options: Schema): NormalizedSchema {
  const project =
    options.project ?? readWorkspaceConfiguration(tree).defaultProject;
  const { root } = readProjectConfiguration(tree, project);

  return {
    ...options,
    project,
    projectRoot: root,
    names: names(options.name),
  };
}
