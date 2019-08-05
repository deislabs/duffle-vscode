// import * as vscode from 'vscode';

// import { Linter } from './linters';
// import * as buildDefinition from '../duffle/builddefinition';
// import { subdirectoriesFromFile } from '../utils/fsutils';
// import { iter, Enumerable } from '../utils/iterable';
// import { getSymbols, WithSymbol } from '../utils/symbols';
// import { Pair, fromMap } from '../utils/pairs';

// export class InvocationImageNameMustBeSubdirectory implements Linter {
//     canLint(document: vscode.TextDocument): boolean {
//         return isDuffleBuildDefinition(document);
//     }

//     async lint(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
//         if (document.uri.scheme !== 'file') {
//             return [];
//         }

//         const buildDefinitionPath = document.uri.fsPath;
//         const subdirectories = subdirectoriesFromFile(buildDefinitionPath);

//         const symbols = invocationImageSymbols(await getSymbols(document));

//         const diagnostics =
//             invocationImages(document)
//                 .filter((m) => !isPresent(m.key, subdirectories))
//                 .map((m) => invocationImageSymbol(symbols, m))
//                 .filter((m) => !!m.symbol)
//                 .map((m) => makeNotSubdirectoryDiagnostic(m.symbol!.selectionRange, m.value.key));

//         return diagnostics.toArray();
//     }
// }

// export class InvocationImageNameMustMatchNameElement implements Linter {
//     canLint(document: vscode.TextDocument): boolean {
//         return isDuffleBuildDefinition(document);
//     }

//     async lint(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
//         const symbols = invocationImageSymbols(await getSymbols(document));

//         const diagnostics =
//             invocationImages(document)
//                 .map((m) => invocationImageSymbol(symbols, m))
//                 .collect((m) => nameDiagnostics(m, document));

//         return diagnostics.toArray();
//     }
// }

// function invocationImageSymbols(symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
//     const parent = symbols.find((s) => s.name === "invocationImages");
//     return parent ? parent.children : [];
// }

// function invocationImageSymbol(symbols: vscode.DocumentSymbol[], image: Pair<InvocationImage>): WithSymbol<Pair<InvocationImage>> {
//     // TODO: this feels like we are mishandling an early stage where the symbols are not
//     // yet available - worry is we could fail to display diagnostics and they wouldn't
//     // appear until the document is edited
//     return { value: image, symbol: symbols.find((s) => s.name === image.key) };
// }

// interface InvocationImage {
//     readonly name: string;
// }

// function isDuffleBuildDefinition(document: vscode.TextDocument): boolean {
//     return document.languageId === buildDefinition.languageId && document.uri.toString().endsWith(buildDefinition.definitionFile);
// }

// function invocationImages(document: vscode.TextDocument): Enumerable<Pair<InvocationImage>> {
//     return iter(invocationImagesCore(document));
// }

// function invocationImagesCore(document: vscode.TextDocument): Pair<InvocationImage>[] {
//     try {
//         const buildDef = JSON.parse(document.getText());
//         if (buildDef) {
//             return fromMap<InvocationImage>(buildDef.invocationImages);
//         }
//         return [];
//     } catch {
//         return [];  // text may be temporarily invalid due to edit in progress
//     }
// }

// function isPresent(name: string, candidates: string[]): boolean {
//     return candidates.indexOf(name) >= 0;
// }

// function* nameDiagnostics(image: WithSymbol<Pair<InvocationImage>>, document: vscode.TextDocument): IterableIterator<vscode.Diagnostic> {
//     if (!image.symbol) {
//         return;
//     }
//     const nameSymbol = findNameSymbol(image.symbol);
//     if (!nameSymbol) {
//         yield makeNoNameDiagnostic(image.symbol.selectionRange);
//         return;
//     }
//     const invocationImage = image.value;
//     if (invocationImage.key !== invocationImage.value.name) {
//         yield makeNameMismatchDiagnostic(nameSymbol.range, invocationImage.key, invocationImage.value.name);
//     }
// }

// function findNameSymbol(imageSymbol: vscode.DocumentSymbol): vscode.DocumentSymbol | undefined {
//     return imageSymbol.children.find((s) => s.name === "name");
// }

// function makeNotSubdirectoryDiagnostic(range: vscode.Range, name: string): vscode.Diagnostic {
//     return new vscode.Diagnostic(range, `${name} is not a subdirectory`, vscode.DiagnosticSeverity.Warning);
// }

// function makeNoNameDiagnostic(range: vscode.Range) {
//     return new vscode.Diagnostic(range, `Image specification does not contain a 'name' element`, vscode.DiagnosticSeverity.Warning);
// }

// function makeNameMismatchDiagnostic(range: vscode.Range, titleName: string, containedName: string) {
//     return new vscode.Diagnostic(range, `Image name ${titleName} does not match 'name' element ${containedName}`, vscode.DiagnosticSeverity.Warning);
// }
