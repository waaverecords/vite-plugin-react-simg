import { PluginOption } from 'vite';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { JSXElement, JSXIdentifier, isJSXAttribute, JSXAttribute, isStringLiteral, StringLiteral, jsxAttribute, jsxExpressionContainer, jsxIdentifier, numericLiteral, stringLiteral } from '@babel/types';
import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch';
import sharp from 'sharp';
import generate from '@babel/generator';

export default function simg(): PluginOption {
    return {
        name: 'simg',
        enforce: 'pre',
        
        async transform(code, id) {

            if (!/\.(j|t)sx?$/.test(id) || id.includes('node_modules'))
                return;

            const ast = parse(code,{
                sourceType: 'module',
                plugins: ['jsx', 'typescript']
            });
            const nodes = new Array<JSXElement>();

            traverse(ast, {
                // https://lihautan.com/babel-ast-explorer
                
                JSXElement(p) {
                    if ((p.node.openingElement.name as JSXIdentifier | undefined)?.name !== 'Sim') return;

                    const srcAttribute = p.node.openingElement.attributes.find(x =>
                        isJSXAttribute(x)
                        && isStringLiteral(x.value)
                        && x.name.name === 'src'
                    );
                    if (!srcAttribute) return;

                    nodes.push(p.node);
                }
            });

            if (!nodes.length) return;

            for (const node of nodes) {
                const attributes = node.openingElement.attributes;
                const srcAttribute = attributes.find(x => isJSXAttribute(x) && x.name.name === 'src') as JSXAttribute;
                const srcLiteral = (srcAttribute.value as StringLiteral);
                const src = srcLiteral.value;

                const imageName = path.basename(src).split('.')[0];
                const imageExt = path.extname(src.split('?')[0]);

                const folderPath = path.join(__dirname, 'public', 'Simg', imageName);
                if (!fs.existsSync(folderPath))
                    fs.mkdirSync(folderPath, { recursive: true });

                const filePath = path.join(folderPath, `${imageName}${imageExt}`);

                // TODO: caching mechanism
                const response = await fetch(src);
                const dest = fs.createWriteStream(filePath);
                response.body?.pipe(dest);

                const webUrl = `/Simg/${imageName}/${imageName}${imageExt}`;
                srcLiteral.value = webUrl;

                const image = sharp(filePath);
                // TODO: caching mechanism
                // TODO: promise.all
                const { width, height } = await image.metadata();
                const { dominant } = await image.stats();
                // TODO: generate smaller image versions with modes (blurry, fractal, gradient, ...)

                if (width) {
                    const widthAttribute = jsxAttribute(
                        jsxIdentifier('width'),
                        jsxExpressionContainer(numericLiteral(width))
                    );
                    attributes.push(widthAttribute);
                }

                if (height) {
                    const heightAttribute = jsxAttribute(
                        jsxIdentifier('height'),
                        jsxExpressionContainer(numericLiteral(height))
                    );
                    attributes.push(heightAttribute);
                }

                const colorAttribute = jsxAttribute(
                    jsxIdentifier('color'),
                    jsxExpressionContainer(stringLiteral(`rgb(${dominant.r}, ${dominant.g}, ${dominant.b})`))
                );
                attributes.push(colorAttribute);
            }

            const output = generate(ast, { sourceMaps: true }, code);
            
            return {
                code: output.code,
                map: output.map,
                // TODO: convert to AcornNode?
                ast: ast as any
            };
        }
    };
};