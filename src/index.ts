import { PluginOption } from 'vite';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { JSXElement, JSXIdentifier, isJSXAttribute, JSXAttribute, isStringLiteral, StringLiteral, jsxAttribute, jsxExpressionContainer, jsxIdentifier, numericLiteral, stringLiteral, NumericLiteral, JSXExpressionContainer } from '@babel/types';
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

                const folderPath = path.join(__dirname, 'public', 'simg', imageName);
                if (!fs.existsSync(folderPath))
                    fs.mkdirSync(folderPath, { recursive: true });

                const filePath = path.join(folderPath, `${imageName}${imageExt}`);
                var webUrl = `/simg/${imageName}/${imageName}${imageExt}`;

                // TODO: caching mechanism
                const response = await fetch(src);
                const dest = fs.createWriteStream(filePath);
                response.body?.pipe(dest);

                var widthAttribute = attributes.find(x => isJSXAttribute(x) && x.name.name === 'width') as JSXAttribute | undefined;
                if (!widthAttribute)
                    attributes.push(jsxAttribute(
                        jsxIdentifier('height'),
                        jsxExpressionContainer(numericLiteral(0))
                    ));
                const widthLiteral = (widthAttribute!.value as JSXExpressionContainer).expression as NumericLiteral;
                var sWidth = widthLiteral.value;

                var heightAttribute = attributes.find(x => isJSXAttribute(x) && x.name.name === 'height') as JSXAttribute | undefined;
                if (!heightAttribute)
                    attributes.push(jsxAttribute(
                        jsxIdentifier('height'),
                        jsxExpressionContainer(numericLiteral(0))
                    ));
                const heightLiteral = (heightAttribute!.value as JSXExpressionContainer).expression as NumericLiteral;
                var sHeight = heightLiteral.value;

                const image = sharp(filePath);
                // TODO: caching mechanism
                // TODO: generate smaller image versions with modes (blurry, fractal, gradient, ...)

                if (sWidth || sHeight) {

                    if (!!sWidth !== !!sHeight) {
                        const { width, height } = await image.metadata();
                        if (!width && !height) continue;
    
                        if (sWidth) sHeight = height! * sWidth / width!;
                        else sWidth = width! * sHeight / height!;
    
                        widthLiteral.value = sWidth;
                        heightLiteral.value = sHeight;
                    }
                    
                    // TODO: save image with new dimensions and new name
                    webUrl = `/simg/${imageName}/${imageName}-${sWidth || ''}x${sHeight || ''}${imageExt}`;
                }
                srcLiteral.value = webUrl;

                const { dominant } = await image.stats();
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