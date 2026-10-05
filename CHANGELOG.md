# Changelog

## 1.3.0

### Features

- accept a hold prompt for forced-command sessions
  ([1c80d5c](https://github.com/hugojosefson/dropbear-auto-unlock/commit/1c80d5c6f91163e36c9d0224ac1cf95badaeea3e))

## 1.2.0

### Features

- expose watcher snapshots and log machine events
  ([621720a](https://github.com/hugojosefson/dropbear-auto-unlock/commit/621720aa042069127fd948e33e39feff30224116))

### Other

- webstorm config
  ([77ae4cb](https://github.com/hugojosefson/dropbear-auto-unlock/commit/77ae4cbca2c94272943aec6cb863da535ef3d3b8))
- align gh actions w/ hj features
  ([6bf3936](https://github.com/hugojosefson/dropbear-auto-unlock/commit/6bf3936243425edb3cd9a07070e6d2a135272037))

## 1.1.0

### Features

- publish strict API types and clarify ZFS support
  ([799e7ee](https://github.com/hugojosefson/dropbear-auto-unlock/commit/799e7eee65b0239b50fc1406432b847a7cb3c0dd))

### Other

- give the unlock machine an explicit type
  ([5ec3531](https://github.com/hugojosefson/dropbear-auto-unlock/commit/5ec3531f25057e75cff879d1fb21cc202483a33b))
- update local hj generation tasks to 0.17.0
  ([fb74196](https://github.com/hugojosefson/dropbear-auto-unlock/commit/fb741963c8bea5d514045a66f4c3ec5467c70f66))

## 1.0.1

### Other

#### github-ci

- enable feature
  ([184e94b](https://github.com/hugojosefson/dropbear-auto-unlock/commit/184e94b89202175b30bd50880458012dc1d879d6))

#### github-release-publish-jsr

- enable feature
  ([31f076c](https://github.com/hugojosefson/dropbear-auto-unlock/commit/31f076c75925df1873429cd9e3176f9fc04b310f))

#### github-release-publish-tag

- enable feature
  ([35a3193](https://github.com/hugojosefson/dropbear-auto-unlock/commit/35a3193385f01bdc40b2fea415e2f84424708d3d))

## 1.0.0

### BREAKING CHANGE

- add typed unlock actors
  ([25aa740](https://github.com/hugojosefson/dropbear-auto-unlock/commit/25aa7403272caa2390492eb5b571378616091926))

  the package root exports the library. Install the CLI from the /cli export.

### Features

- expose grouped unlock watchers and use them from the CLI
  ([20c0463](https://github.com/hugojosefson/dropbear-auto-unlock/commit/20c0463fc84f6e19dcad9d4ef164e5f4a3baf753))

### Fixes

- point at new semver service URL (semver.se.deno.net)
  ([ecfa10d](https://github.com/hugojosefson/dropbear-auto-unlock/commit/ecfa10dfd95c393208a4f67a8fe388c58b585f03))
- preserve configured SSH ports
  ([b2449e3](https://github.com/hugojosefson/dropbear-auto-unlock/commit/b2449e38ba8b72a28e4323eabe1a6b628ccc3ab3))

### Other

- use hj workflows and repair tag publication
  ([c7fa9f3](https://github.com/hugojosefson/dropbear-auto-unlock/commit/c7fa9f347b361bccb6fa1631c001c4f3ebb7cdfa))
- align README generation with hj
  ([d317e19](https://github.com/hugojosefson/dropbear-auto-unlock/commit/d317e19eed82ddd516a813fcff9d62ca34c5f867))
- keep IDE files outside Deno formatting
  ([6aca6d0](https://github.com/hugojosefson/dropbear-auto-unlock/commit/6aca6d0f4af966464f077af80f3971325c770f6b))
- align the hj release baseline with existing tags
  ([0341dcc](https://github.com/hugojosefson/dropbear-auto-unlock/commit/0341dcca82477a57e29381a1a1616b7b4b378bb0))
- use hj 0.16.3 for JSR publication
  ([0a62730](https://github.com/hugojosefson/dropbear-auto-unlock/commit/0a62730e5accceeaaa0a36c70f41d25ba4039a61))

#### github-ci

- enable feature
  ([7c8912c](https://github.com/hugojosefson/dropbear-auto-unlock/commit/7c8912c7100eaaff91dd9a3de524c59c8339850c))
- enable feature
  ([d104259](https://github.com/hugojosefson/dropbear-auto-unlock/commit/d10425918029f6f397941aaeeb38d56b789098dd))

#### github-release-publish-jsr

- enable feature
  ([91f1538](https://github.com/hugojosefson/dropbear-auto-unlock/commit/91f1538fab854b7ea17cad6ef91b409945f87ae8))
- enable feature
  ([65a323e](https://github.com/hugojosefson/dropbear-auto-unlock/commit/65a323e6319c5553fdbeca5e24c070304eb2c9d2))

#### github-release-publish-tag

- enable feature
  ([4b05fc1](https://github.com/hugojosefson/dropbear-auto-unlock/commit/4b05fc15d6d21da4987458d3038df0e10b22054b))
- enable feature
  ([b0e95d3](https://github.com/hugojosefson/dropbear-auto-unlock/commit/b0e95d3f372ac1578d78e50141c9d372c1b768ef))
