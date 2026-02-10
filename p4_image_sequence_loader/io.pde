import java.util.Arrays.*;
import java.io.*;

File[] scanFolder(String path, final String ext, boolean sort) {

  File dir = new File(path);

  File[] files = dir.listFiles(new FilenameFilter() {
    public boolean accept(File f, String filename) {
      return filename.endsWith(ext);
    }
  }
  );

  // Alphabetical
  if (files == null) files = new File[0];
  if (sort) {
    java.util.Arrays.sort(files);
  }
  return files;
}

File[] listFolders(String path) {
  File dir = new File(path);

  File[] files = dir.listFiles(new FileFilter() {
    public boolean accept(File f) {
      return f.isDirectory();
    }
  }
  );
  // Alphabetical
  if (files == null) files = new File[0];
  java.util.Arrays.sort(files);

  return files;
}

ArrayList<PImage> loadImagesFromFolder(String path) {

  ArrayList<PImage> target = new ArrayList();

  target.clear();
  File[] images = scanFolder(path, "png", true);

  for (File f : images) {
    target.add(loadImage(f.getAbsolutePath()));
  }

  return target;
}
