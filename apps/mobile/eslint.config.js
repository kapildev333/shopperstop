import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist', 'dist-e2e', '.expo'] },
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
)
