import axios, { AxiosResponse } from 'axios';
import fs from 'fs';
import * as triplesec from 'triplesec';
import FormData from 'form-data';
import ora from 'ora';
import mime from 'mime';

const args: string[] = process.argv.slice(2);
const domain: string = 'https://api.sendsh.it';

/**
 * Read a file from disk.
 *
 * @param fileName
 */
async function readFile(fileName: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => fs.readFile(fileName, (err, data: Buffer) => {
        if (err) {
            return reject(err);
        }
        resolve(data);
    }));
}

/**
 * Encrypt a file.
 *
 * @param fileName
 * @param fileData
 * @param key
 */
async function encryptFile(fileName: string, fileData: Buffer, key: string): Promise<Buffer|null> {
    const opts = {
        data: new Buffer(JSON.stringify({
            url: `data:${mime.getType(fileName)};base64,${fileData.toString('base64')}`,
            name: fileName,
        })),
        key: new Buffer(key),
    };

    return new Promise<Buffer|null>((resolve, reject) => triplesec.encrypt(opts, (err, buff) => {
        if (err) {
            return reject(err);
        }
        resolve(buff);
    }));
}

/**
 * Upload encrypted data to the API.
 *
 * @param encryptedData
 */
async function uploadFile(encryptedData: Buffer) {
    const formData: FormData = new FormData();
    formData.append('upload', encryptedData.toString('hex'), 'encrypted');

    return axios.post(`${domain}/upload`, formData, {
        headers: formData.getHeaders(),
    });
}

/**
 * Encrypt and upload a file.
 *
 * @param fileName
 */
async function main(fileName: string) {
    let fileData: Buffer;
    let encryptedData: Buffer;
    let response: AxiosResponse<{ id: string }>;

    const spinner = new ora('Encrypting some shit').start();

    const key: string = await new Promise<string>(resolve =>
        triplesec.prng.generate(24, (words: triplesec.WordArray) =>
            resolve(words.to_hex())
        )
    );

    try {
        fileData = await readFile(fileName);
    } catch (error) {
        spinner.fail('Couldn\'t read that shit');
        process.exit(1);
    }

    try {
        encryptedData = await encryptFile(fileName, fileData, key);
    } catch (error) {
        spinner.fail('Couldn\'t encrypt that shit');
        process.exit(1);
    }

    spinner.text = 'Uploading some shit';

    try {
        response = await uploadFile(encryptedData);
    } catch (error) {
        spinner.fail('Couldn\'t upload that shit');
        process.exit(1);
    }

    const url: string = `https://sendsh.it/#/${response.data.id}/${key}`;

    spinner.succeed(url);
    process.exit();
}

if (args.length !== 1) {
    console.log('Usage: sendshit <file>');
    process.exit();
}

main(args[0]);
