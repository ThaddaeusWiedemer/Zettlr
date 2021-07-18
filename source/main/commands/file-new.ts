/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        FileNew command
 * CVM-Role:        <none>
 * Maintainer:      Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     This command creates a new file.
 *
 * END HEADER
 */

import ZettlrCommand from './zettlr-command'
import { trans } from '../../common/i18n-main'
import path from 'path'
import sanitize from 'sanitize-filename'
import { codeFileExtensions, mdFileExtensions } from '../../common/get-file-extensions'
import generateFilename from '../../common/util/generate-filename'

const CODEFILE_TYPES = codeFileExtensions(true)
const ALLOWED_FILETYPES = mdFileExtensions(true)

export default class FileNew extends ZettlrCommand {
  constructor (app: any) {
    super(app, [ 'file-new', 'new-unsaved-file' ])
  }

  /**
   * Create a new file.
   * @param {String} evt The event name
   * @param  {Object} arg An object containing a hash of containing directory and a file name.
   * @return {void}     This function does not return anything.
   */
  async run (evt: string, arg: any): Promise<void> {
    if (evt === 'new-unsaved-file') {
      // We should simply create a new unsaved file that only resides in memory
      const file = await this._app.getDocumentManager().newUnsavedFile()
      // Set it as active
      this._app.getDocumentManager().activeFile = file
      return // Return early
    }

    let dir = this._app.getFileSystem().openDirectory

    if ('path' in arg) {
      dir = this._app.getFileSystem().findDir(arg.path)
    }

    if (dir === null) {
      global.log.error(`Could not create new file ${arg.name as string}: No directory selected!`)
      return
    }

    try {
      // Then, make sure the name is correct.
      let filename = (arg.name !== undefined) ? sanitize(arg.name.trim(), { 'replacement': '-' }) : generateFilename()
      if (filename === '') {
        throw new Error('Could not create file: Filename was not valid')
      }

      // If no valid filename is provided, assume .md
      let ext = path.extname(filename).toLowerCase()
      if (!ALLOWED_FILETYPES.includes(ext) && !CODEFILE_TYPES.includes(ext)) {
        filename += '.md'
      }

      // Check if there's already a file with this name in the directory
      // NOTE: There are case-sensitive file systems, but we'll disallow this
      let found = dir.children.find(e => e.name.toLowerCase() === filename.toLowerCase())
      if (found !== undefined && found.type !== 'directory') {
        // Ask before overwriting
        if (!await this._app.shouldOverwriteFile(filename)) {
          return
        } else {
          // Remove the file before creating it anew. We'll use the
          // corresponding command for that.
          await this._app.getFileSystem().removeFile(found)
        }
      }

      // First create the file
      await this._app.getFileSystem().createFile(dir, {
        name: filename,
        content: ''
      })

      // And directly thereafter, open the file
      await this._app.openFile(path.join(dir.path, filename))
    } catch (e) {
      global.log.error(`Could not create file: ${e.message as string}`)
      this._app.prompt({
        type: 'error',
        title: trans('system.error.could_not_create_file'),
        message: e.message
      })
    }
  }
}
