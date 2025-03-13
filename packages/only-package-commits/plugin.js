import { spawn } from 'child_process';

const debug = (...args) => console.log(...args);

/** @param {import("semantic-release").AnalyzeCommitsContext} context  */
export async function analyzeCommits(config, context) {
  context.commits = await onlyPackageCommits(context.commits, config);
  const plugin = await import('@semantic-release/commit-analyzer');
  const result = await plugin.analyzeCommits(config, context);
  return result;
}

/** @param {import("semantic-release").GenerateNotesContext} context  */
export async function generateNotes(config, context) {
  const plugin = await import('@semantic-release/release-notes-generator');
  context.commits = await onlyPackageCommits(context.commits, config);
  const result = await plugin.generateNotes(config, context);
  return result;
}

/** @param {{ ignore: string[], include: string[] }} options */
async function onlyPackageCommits(commits, options) {
  const commitsWithFiles = await withFiles(commits);

  return commitsWithFiles.filter(({ files, subject }) => {
    if (options.include) {
      const packageFile = files.find(file => options.include.some(pattern => file.startsWith(pattern)));
      if (packageFile) {
        debug(
          'Including commit "%s" because it modified package file "%s".',
          subject,
          packageFile
        );
      }
      return !!packageFile;
    } else if (options.ignore) {
      const packageFile = files.find(file => options.ignore.some(pattern => file.startsWith(pattern)));
      if (packageFile) {
        debug(
          'Ignoring commit "%s" because it modified package file "%s".',
          subject,
          packageFile
        );
      }
      return !packageFile;
    } else {
      return true;
    }
  });
};

const withFiles = async commits => {
  return Promise.all(commits.map(async commit => {
    const files = await getCommitFiles(commit.hash);
    return { ...commit, files };
  }));
};

const getCommitFiles = async (hash) => {
  const output = await git(['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', hash]);
  return output.split('\n').filter(Boolean);
};

const git = async (args) => {
  return new Promise((resolve, reject) => {
    const process = spawn('git', args, {
      stdio: ['ignore', 'pipe', 'inherit']
    });

    let output = '';
    process.stdout.on('data', data => {
      output += data.toString();
    });

    process.on('close', code => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`git process exited with code ${code}`));
      }
    });
  });
};
