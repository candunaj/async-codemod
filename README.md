# async-codemod is transform for jscodeshift
It will refactor (arrow)functions returning promises to async (arrow)functions.

## Example
```
function example() {
  return new Promise((resolve, reject) => {
    let a = 2;
    let b = a + 1;
    functionReturnPromise().then(
      (res) => {
        resolve(res);
      },
      (err) => {
        console.log(err);
        reject(err);
      }
    );
  });
}
```

## Will be refactored
```
async function example() {
  let a = 2;
  let b = a + 1;

  try {
    let res = await functionReturnPromise();
    return res;
  } catch (err) {
    console.log(err);
    throw err;
  }
}
```

# using
jscodeshift -t async-transform.js path/**/*.js
