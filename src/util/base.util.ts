const fs = require('fs')
const path = require('path')

export const rmdir = (dir:string) => {
  const list = fs.readdirSync(dir)

  for(let i = 0; i < list.length; i++) {
    const filename = path.join(dir, list[i])
    const stat = fs.statSync(filename)

    if(filename == "." || filename == "..") {
      // pass these files
    } else if(stat.isDirectory()) {
      // rmdir recursively
      rmdir(filename)
    } else {
      // rm fiilename
      fs.unlinkSync(filename)
    }
  }
  fs.rmdirSync(dir)
}

export const getAcctPath = (source: string, email: string) => {
  const primaryAccts = fs.readdirSync(source, { withFileTypes: true })
    .filter((dirent:any) => dirent.isDirectory())
    .map((dirent:any) => dirent.name)

  if(primaryAccts.indexOf(email) > -1) {
    return path.join(source, email)
  } else {
    const domain = email.split('@')[1]

    for(const acct of primaryAccts) {
      const domainsPath = path.join(source, `${acct}/Domains`)

      if(fs.existsSync(domainsPath)) {
        const domains = fs.readdirSync(domainsPath, { withFileTypes: true })
          .filter((dirent:any) => dirent.isDirectory())
          .map((dirent:any) => dirent.name)

        if(domains.indexOf(domain) > -1) {
          for(const domain of domains) {
            const domainsAcctPath = path.join(source, `${acct}/Domains/${domain}`)

            const domainAccts = fs.readdirSync(domainsAcctPath, { withFileTypes: true })
              .filter((dirent:any) => dirent.isDirectory())
              .map((dirent:any) => dirent.name)

            for(const dAcct of domainAccts) {
              if(dAcct === email) {
                return path.join(source, `/${acct}/Domains/${domain}/${dAcct}`)
              }
            }
          }
        }
      }
    }
  }
}