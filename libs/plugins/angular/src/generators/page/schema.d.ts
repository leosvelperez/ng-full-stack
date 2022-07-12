import { names } from '@nrwl/devkit';

export interface Schema {
  name: string;
  path?: string;
  project?: string;
  displayBlock?: boolean;
  standalone?: boolean;
  viewEncapsulation?: 'Emulated' | 'None' | 'ShadowDom';
  changeDetection?: 'Default' | 'OnPush';
  style?: 'css' | 'scss' | 'sass' | 'less' | 'none';
  skipTests?: boolean;
}

export interface NormalizedSchema extends Schema {
  names: ReturnType<typeof names>;
  project: string;
  projectRoot: string;
}
