const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const expect = require('chai').expect;
const create = require('..');
const bemFsScheme = require('bem-fs-scheme');
const naming = require('bem-naming');
const EOL = require('os').EOL;

const tmpDir = path.join(__dirname, 'tmp');
const initialCwd = process.cwd();

const templates = {
    css: function(entity, namingScheme) {
        const className = typeof entity === 'string' ? entity : naming(namingScheme).stringify(entity);

        return [
            '.' + className + ' {',
            '    ',
            '}',
        ''].join(EOL);
    }
}

function testEntityHelper(entities, levels, techs, options, expected) {
    return create(entities, levels, techs, options).then(() => {
        expected.forEach(file => {
            let actualContent;
            if (typeof file.content === 'undefined') {
                file.content = '';
            }

            try {
                actualContent = fs.readFileSync(file.name, 'utf8');
            } catch(err) {
                throw new Error(`Error: ${file.name} was not created`);
            }

            if (actualContent !== file.content) {
                throw new Error(`Error: ${file.name} content is not correct`);
            }
        })
    });

}

describe('bem-tools-create', () => {
    beforeEach(() => mkdirp.sync(tmpDir));
    afterEach(() => {
        rimraf.sync(tmpDir);
        process.chdir(initialCwd);
    });

    describe('default scheme and default naming', () => {
        it('should create a block using `nested` scheme and default naming', () => {
            return testEntityHelper([{ block: 'b' }], [tmpDir], ['css'], {}, [{
                name: path.join(tmpDir, 'b', 'b.css'),
                content: templates.css('b')
            }]);
        });

        it('should create an element using `nested` scheme and default naming', () => {
            return testEntityHelper([{ block: 'b', elem: 'e' }], [tmpDir], ['css'], {}, [{
                name: path.join(tmpDir, 'b', '__e', 'b__e.css'),
                content: templates.css('b__e')
            }]);
        });

        it('should create an block modifier using `nested` scheme and default naming', () => {
            return testEntityHelper([{ block: 'b', modName: 'm', modVal: 'v' }], [tmpDir], ['css'], {}, [{
                name: path.join(tmpDir, 'b', '_m', 'b_m_v.css'),
                content: templates.css('b_m_v')
            }]);
        });

        it('should create an element modifier using `nested` scheme and default naming', () => {
            return testEntityHelper([{ block: 'b', elem: 'e', modName: 'em', modVal: 'ev' }], [tmpDir], ['css'], {}, [{
                name: path.join(tmpDir, 'b', '__e', '_em', 'b__e_em_ev.css'),
                content: templates.css('b__e_em_ev')
            }]);
        });

        it('should create a block with different techs', () => {
            return testEntityHelper([{ block: 'b' }], [tmpDir], ['css', 'deps.js'], {}, [
                {
                    name: path.join(tmpDir, 'b', 'b.css'),
                    content: templates.css('b')
                },
                {
                    name: path.join(tmpDir, 'b', 'b.deps.js'),
                    content: ['({', '    shouldDeps: [', '        ', '    ]', '})', ''].join(EOL)
                }
            ]);
        });
    });

    describe('custom options', () => {
        it('should create entities with naming from config', () => {
            const entity = { block: 'b', elem: 'e1', modName: 'm1', modVal: 'v1' };
            const namingScheme = {
                elem: '-',
                mod: { name: '--', val: '_' }
            };

            return testEntityHelper([entity], [tmpDir], ['css'], { defaults: { naming: namingScheme } }, [{
                name: path.join(tmpDir, 'b', '-e1', '--m1', 'b-e1--m1_v1.css'),
                content: templates.css(entity, namingScheme)
            }]);
        });

        it('should create blocks with scheme from config', () => {
            const entity = { block: 'b', elem: 'e1', modName: 'm1', modVal: 'v1' };

            return testEntityHelper([entity], [tmpDir], ['css'], { defaults: { scheme: 'flat' } }, [{
                name: path.join(tmpDir, 'b__e1_m1_v1.css'),
                content: templates.css(entity)
            }]);
        });

        describe('levels', () => {
            it('should create a block on levels from config', () => {
                const opts = {
                    defaults: { levels: {} },
                    fsRoot: tmpDir,
                    fsHome: tmpDir
                };

                ['level1', 'level2'].forEach(function(lvl) {
                    const level = path.join(tmpDir, lvl);

                    mkdirp.sync(level);

                    opts.defaults.levels[level] = { default: true };
                });

                return testEntityHelper([{ block: 'b' }], null, ['css'], opts, [
                    {
                        name: path.join(tmpDir, 'level1', 'b', 'b.css'),
                        content: templates.css('b')
                    },
                    {
                        name: path.join(tmpDir, 'level2', 'b', 'b.css'),
                        content: templates.css('b')
                    },
                ]);
            });

            it('should create entities on levels with provided config', () => {
                const levels = [path.join(tmpDir, 'l1'), path.join(tmpDir, 'l2')];
                const entity = { block: 'b', elem: 'e1', modName: 'm1', modVal: 'v1' };
                const namingScheme = {
                    elem: '-',
                    mod: { name: '--', val: '_' }
                };
                const opts = {
                    defaults: {
                        levels: {}
                    }
                };

                opts.defaults.levels[levels[0]] = {
                    naming: namingScheme
                };

                opts.defaults.levels[levels[1]] = {
                    scheme: 'flat'
                };

                return testEntityHelper([entity], levels, ['css'], opts, [
                    {
                        name: path.join(tmpDir, 'l1', 'b', '-e1', '--m1', 'b-e1--m1_v1.css'),
                        content: templates.css(entity, namingScheme)
                    },
                    {
                        name: path.join(tmpDir, 'l2', 'b__e1_m1_v1.css'),
                        content: templates.css(entity)
                    },
                ]);
            });

            it('should create a block on cwd as a fallback', () => {
                const fakeCwd = path.join(tmpDir, 'cwd');
                mkdirp.sync(fakeCwd);
                process.chdir(fakeCwd);

                return testEntityHelper([{ block: 'b' }], null, ['css'], { fsRoot: tmpDir, fsHome: tmpDir }, [{
                    name: path.join(fakeCwd, 'b', 'b.css'),
                    content: templates.css('b')
                }]);
            });

            it('should create block on provided levels', () => {
                return testEntityHelper([{ block: 'b' }], [tmpDir], ['css'], { fsRoot: tmpDir, fsHome: tmpDir }, [{
                    name: path.join(tmpDir, 'b', 'b.css'),
                    content: templates.css('b')
                }]);
            });
        });

        describe('techs', () => {
            it('should create block in techs from config', () => {
                const opts = {
                    defaults: {
                        modules: {
                            'bem-tools': {
                                plugins: {
                                    create: {
                                        techs: ['tech1', 'tech2']
                                    }
                                }
                            }
                        }
                    },
                    fsRoot: tmpDir,
                    fsHome: tmpDir
                }

                return testEntityHelper([{ block: 'b' }], [tmpDir], null, opts, [
                    { name: path.join(tmpDir, 'b', 'b.tech1') },
                    { name: path.join(tmpDir, 'b', 'b.tech2') }
                ]);
            });

            it('should create block in techs from config and provided techs', () => {
                const opts = {
                    defaults: {
                        modules: {
                            'bem-tools': {
                                plugins: {
                                    create: {
                                        techs: ['tech1', 'tech2']
                                    }
                                }
                            }
                        }
                    },
                    fsRoot: tmpDir,
                    fsHome: tmpDir
                }

                return testEntityHelper([{ block: 'b' }], [tmpDir], ['tech3', 'tech4'], opts, [
                    { name: path.join(tmpDir, 'b', 'b.tech1') },
                    { name: path.join(tmpDir, 'b', 'b.tech2') },
                    { name: path.join(tmpDir, 'b', 'b.tech3') },
                    { name: path.join(tmpDir, 'b', 'b.tech4') }
                ]);
            });

            // TODO: check that it fires only twice instead of four times
            it('should create block in techs from config and the same provided techs', () => {
                const opts = {
                    defaults: {
                        modules: {
                            'bem-tools': {
                                plugins: {
                                    create: {
                                        techs: ['tech1', 'tech2']
                                    }
                                }
                            }
                        }
                    },
                    fsRoot: tmpDir,
                    fsHome: tmpDir
                }

                return testEntityHelper([{ block: 'b' }], [tmpDir], ['tech1', 'tech2'], opts, [
                    { name: path.join(tmpDir, 'b', 'b.tech1') },
                    { name: path.join(tmpDir, 'b', 'b.tech2') }
                ]);
            });

            it('should create block only in provided techs', () => {
                const opts = {
                    onlyTech: true,
                    defaults: {
                        modules: {
                            'bem-tools': {
                                plugins: {
                                    create: {
                                        techs: ['defTech1', 'defTech2']
                                    }
                                }
                            }
                        }
                    },
                    fsRoot: tmpDir,
                    fsHome: tmpDir
                }

                return testEntityHelper([{ block: 'b' }], [tmpDir], ['only1', 'only2'], opts, [
                    { name: path.join(tmpDir, 'b', 'b.only1') },
                    { name: path.join(tmpDir, 'b', 'b.only2') }
                ]);
            });
        });

        describe('template', () => {
            it('should create a block using templates from config', () => {
                const opts = {
                    onlyTech: true,
                    defaults: {
                        modules: {
                            'bem-tools': {
                                plugins: {
                                    create: {
                                        templates: {
                                            css: path.join(__dirname, 'tech-templates', 'css')
                                        }
                                    }
                                }
                            }
                        }
                    },
                    fsRoot: tmpDir,
                    fsHome: tmpDir
                }

                return testEntityHelper([{ block: 'b' }], [tmpDir], ['css'], opts, [{
                    name: path.join(tmpDir, 'b', 'b.css'),
                    content: '.b { }'
                }]);
            });
        });
    });
});